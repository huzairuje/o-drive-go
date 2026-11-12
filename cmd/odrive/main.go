package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/huzairuje/o-drive-go/internal/api"
	"github.com/huzairuje/o-drive-go/internal/crypto"
	"github.com/huzairuje/o-drive-go/internal/db"
)

func main() {
	var (
		addr      = flag.String("addr", ":8090", "HTTP listen address")
		dbPath    = flag.String("db", "", "Database DSN (PostgreSQL or SQLite)")
		secret    = flag.String("secret", "", "Master vault encryption secret")
		seedOnly  = flag.Bool("seed", false, "Run ecosystem database seeder and exit")
		printKeys = flag.Bool("print-keys", false, "Print ecosystem credentials manifest and exit")
	)
	flag.Parse()

	if *secret == "" {
		*secret = os.Getenv("ODRIVE_SECRET_KEY")
		if *secret == "" {
			*secret = os.Getenv("OMNI_SECRET_KEY")
		}
	}

	dsn := resolveDSN(*dbPath)

	log.Printf("[INFO] Initializing ODrive...")

	// Open database
	store, err := db.Open(dsn)
	if err != nil {
		log.Fatalf("[FATAL] Failed to open database: %v", err)
	}
	defer store.Close()

	// Initialize encryption vault
	vault, err := crypto.NewVault(*secret)
	if err != nil {
		log.Fatalf("[FATAL] Failed to initialize encryption vault: %v", err)
	}

	// Run ecosystem seeder for connected apps and background workers
	seedResult, err := db.SeedEcosystem(context.Background(), store, vault)
	if err != nil {
		log.Printf("[WARN] Seeder completed with warnings: %v", err)
	} else if seedResult != nil {
		log.Printf("[INFO] Provisioning completed successfully: %d drives, %d app keys provisioned.", len(seedResult.Drives), len(seedResult.AppKeys))
	}

	if *seedOnly || *printKeys {
		printEcosystemSummary(seedResult)
		return
	}

	// Build API server
	server := api.NewServer(store, vault)

	httpServer := &http.Server{
		Addr:         *addr,
		Handler:      server.Handler(),
		ReadTimeout:  0, // No timeout for streaming uploads
		WriteTimeout: 0, // No timeout for streaming downloads
		IdleTimeout:  120 * time.Second,
	}

	// Graceful shutdown channel
	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Printf("==================================================")
		log.Printf("  Omni-Drive Go: Storage Gateway & Relay Service")
		log.Printf("==================================================")
		log.Printf("  • Web Console:    http://localhost%s/", *addr)
		log.Printf("  • REST API:       http://localhost%s/api/v1/health", *addr)
		log.Printf("  • S3 Gateway:     http://localhost%s/s3/{bucket}/{key}", *addr)
		log.Printf("  • Public Shares:  http://localhost%s/s/{token}", *addr)
		log.Printf("  • Database Engine: %s (%s)", dsn, store.Driver())
		log.Printf("==================================================")

		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[FATAL] Server listen error: %v", err)
		}
	}()

	<-stopChan
	log.Printf("[INFO] Shutting down Omni-Drive gracefully...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := httpServer.Shutdown(ctx); err != nil {
		log.Printf("[ERROR] Server forced to shutdown: %v", err)
	}
	log.Printf("[INFO] Omni-Drive stopped cleanly.")
}

func resolveDSN(cliDB string) string {
	if cliDB != "" {
		return cliDB
	}
	if envDSN := os.Getenv("DATABASE_URL"); envDSN != "" {
		return envDSN
	}

	host := os.Getenv("POSTGRES_HOST")
	port := os.Getenv("POSTGRES_PORT")
	user := os.Getenv("POSTGRES_USER")
	pass := os.Getenv("POSTGRES_PASSWORD")
	dbname := os.Getenv("POSTGRES_DB")

	if host != "" || user != "" || dbname != "" {
		if host == "" {
			host = "127.0.0.1"
		}
		if port == "" {
			port = "5432"
		}
		if user == "" {
			user = "postgres"
		}
		if pass == "" {
			pass = "postgres"
		}
		if dbname == "" {
			dbname = "odrive"
		}
		sslmode := os.Getenv("POSTGRES_SSLMODE")
		if sslmode == "" {
			sslmode = "disable"
		}
		return fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=%s", user, pass, host, port, dbname, sslmode)
	}

	return "postgres://postgres:postgres@127.0.0.1:5432/odrive?sslmode=disable"
}

func printEcosystemSummary(res *db.EcosystemSeedResult) {
	if res == nil {
		return
	}
	fmt.Println("\n==================================================")
	fmt.Println("  ODRIVE: PROVISIONING SUMMARY")
	fmt.Println("==================================================")
	fmt.Printf("Root Superadmin Email: %s\n", res.RootAdminEmail)
	if res.RootAdminPassword != "" {
		fmt.Printf("Root Superadmin Initial Password: %s\n", res.RootAdminPassword)
	}
	fmt.Println("\nProvisioned Drives:")
	for _, d := range res.Drives {
		fmt.Printf("  • %s (Slug: %s) -> %s\n", d.Name, d.Slug, d.Purpose)
	}

	fmt.Println("\nService API Keys for Connected Applications:")
	for appID, key := range res.AppKeys {
		fmt.Printf("  [%s] %s\n", appID, key.AppName)
		fmt.Printf("    Key ID:     %s\n", key.KeyID)
		if key.SecretKey != "" {
			fmt.Printf("    Secret Key: %s\n", key.SecretKey)
		}
		fmt.Printf("    Scopes:     %s\n", key.Scopes)
		fmt.Println("    Target .env lines:")
		for _, line := range key.TargetEnv {
			fmt.Printf("      %s\n", line)
		}
	}
	if res.ManifestPath != "" {
		fmt.Printf("\nSaved Manifest: %s\n", res.ManifestPath)
	}
	fmt.Println("==================================================")
	fmt.Println()
}
