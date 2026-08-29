// AgentExec keeper — polls PaymasterAutoTopUp and calls executeTopUp when needed.
package main

import (
	"context"
	"crypto/ecdsa"
	"fmt"
	"log"
	"math/big"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
)

// PaymasterAutoTopUp ABI (needsTopUp, executeTopUp, vaultBalance, paymasterBalance).
const paymasterAutoTopUpABI = `[
  {"inputs":[],"name":"needsTopUp","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"executeTopUp","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"vaultBalance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"paymasterBalance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}
]`

func main() {
	rpcURL := getEnv("BASE_RPC_URL", "https://mainnet.base.org")
	contractHex := getEnv("PAYMASTER_TOPUP_CONTRACT", "")
	keeperKeyHex := strings.TrimPrefix(getEnv("KEEPER_PRIVATE_KEY", ""), "0x")
	pollSec := envInt("KEEPER_POLL_SECONDS", 30)

	if contractHex == "" || keeperKeyHex == "" {
		log.Fatal("FATAL: PAYMASTER_TOPUP_CONTRACT and KEEPER_PRIVATE_KEY are required")
	}

	client, err := ethclient.Dial(rpcURL)
	if err != nil {
		log.Fatalf("Failed to connect to Base RPC: %v", err)
	}

	privateKey, err := crypto.HexToECDSA(keeperKeyHex)
	if err != nil {
		log.Fatalf("Invalid KEEPER_PRIVATE_KEY: %v", err)
	}

	chainID, err := client.ChainID(context.Background())
	if err != nil {
		log.Fatalf("Failed to fetch chain ID: %v", err)
	}

	parsed, err := abi.JSON(strings.NewReader(paymasterAutoTopUpABI))
	if err != nil {
		log.Fatalf("Invalid ABI: %v", err)
	}

	contractAddr := common.HexToAddress(contractHex)
	keeperAddr := crypto.PubkeyToAddress(privateKey.PublicKey)

	log.Printf("[AgentExec Keeper] Monitoring PaymasterAutoTopUp at %s (chain %s)", contractAddr.Hex(), chainID.String())
	log.Printf("[AgentExec Keeper] Keeper address: %s | poll=%ds", keeperAddr.Hex(), pollSec)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	ticker := time.NewTicker(time.Duration(pollSec) * time.Second)
	defer ticker.Stop()

	// Run once immediately, then on interval.
	runPoll(ctx, client, parsed, contractAddr, privateKey, chainID)

	for {
		select {
		case <-ctx.Done():
			log.Println("[AgentExec Keeper] Shutting down")
			return
		case <-ticker.C:
			runPoll(ctx, client, parsed, contractAddr, privateKey, chainID)
		}
	}
}

func runPoll(
	ctx context.Context,
	client *ethclient.Client,
	parsed abi.ABI,
	contractAddr common.Address,
	privateKey *ecdsa.PrivateKey,
	chainID *big.Int,
) {
	callCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	vaultBal, pmBal, needs, err := readVaultState(callCtx, client, parsed, contractAddr)
	if err != nil {
		log.Printf("[ERROR] Vault read failed: %v", err)
		return
	}

	log.Printf("[OK] vault=%s paymaster=%s needsTopUp=%v", vaultBal.String(), pmBal.String(), needs)

	if !needs {
		return
	}

	log.Printf("[WARN] Paymaster below threshold — submitting executeTopUp()")
	txHash, err := executeTopUp(callCtx, client, parsed, contractAddr, privateKey, chainID)
	if err != nil {
		log.Printf("[ERROR] executeTopUp failed: %v", err)
		return
	}
	log.Printf("[KEEPER] executeTopUp tx submitted: %s", txHash)
}

func readVaultState(
	ctx context.Context,
	client *ethclient.Client,
	parsed abi.ABI,
	contractAddr common.Address,
) (*big.Int, *big.Int, bool, error) {
	vaultData, err := parsed.Pack("vaultBalance")
	if err != nil {
		return nil, nil, false, err
	}
	pmData, err := parsed.Pack("paymasterBalance")
	if err != nil {
		return nil, nil, false, err
	}
	needsData, err := parsed.Pack("needsTopUp")
	if err != nil {
		return nil, nil, false, err
	}

	vaultOut, err := client.CallContract(ctx, ethereum.CallMsg{To: &contractAddr, Data: vaultData}, nil)
	if err != nil {
		return nil, nil, false, fmt.Errorf("vaultBalance: %w", err)
	}
	pmOut, err := client.CallContract(ctx, ethereum.CallMsg{To: &contractAddr, Data: pmData}, nil)
	if err != nil {
		return nil, nil, false, fmt.Errorf("paymasterBalance: %w", err)
	}
	needsOut, err := client.CallContract(ctx, ethereum.CallMsg{To: &contractAddr, Data: needsData}, nil)
	if err != nil {
		return nil, nil, false, fmt.Errorf("needsTopUp: %w", err)
	}

	vaultVals, err := parsed.Unpack("vaultBalance", vaultOut)
	if err != nil {
		return nil, nil, false, err
	}
	pmVals, err := parsed.Unpack("paymasterBalance", pmOut)
	if err != nil {
		return nil, nil, false, err
	}
	needsVals, err := parsed.Unpack("needsTopUp", needsOut)
	if err != nil {
		return nil, nil, false, err
	}

	return vaultVals[0].(*big.Int), pmVals[0].(*big.Int), needsVals[0].(bool), nil
}

func executeTopUp(
	ctx context.Context,
	client *ethclient.Client,
	parsed abi.ABI,
	contractAddr common.Address,
	privateKey *ecdsa.PrivateKey,
	chainID *big.Int,
) (string, error) {
	from := crypto.PubkeyToAddress(privateKey.PublicKey)
	nonce, err := client.PendingNonceAt(ctx, from)
	if err != nil {
		return "", err
	}

	gasPrice, err := client.SuggestGasPrice(ctx)
	if err != nil {
		return "", err
	}

	data, err := parsed.Pack("executeTopUp")
	if err != nil {
		return "", err
	}

	gasLimit, err := client.EstimateGas(ctx, ethereum.CallMsg{
		From: from,
		To:   &contractAddr,
		Data: data,
	})
	if err != nil {
		gasLimit = 200_000
	}

	tx := types.NewTransaction(nonce, contractAddr, big.NewInt(0), gasLimit, gasPrice, data)
	signed, err := types.SignTx(tx, types.NewEIP155Signer(chainID), privateKey)
	if err != nil {
		return "", err
	}

	if err := client.SendTransaction(ctx, signed); err != nil {
		return "", err
	}
	return signed.Hash().Hex(), nil
}

func getEnv(key, fallback string) string {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		return val
	}
	return fallback
}

func envInt(key string, fallback int) int {
	val := getEnv(key, "")
	if val == "" {
		return fallback
	}
	n := new(big.Int)
	if _, ok := n.SetString(val, 10); !ok {
		return fallback
	}
	return int(n.Int64())
}
