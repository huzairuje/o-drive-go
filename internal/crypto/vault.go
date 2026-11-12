package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"os"
)

var (
	ErrDecryptionFailed = errors.New("failed to decrypt secret: invalid key or corrupted ciphertext")
	ErrEmptyPayload     = errors.New("empty payload cannot be encrypted")
)

type Vault struct {
	key [32]byte
}

// NewVault creates an AES-256-GCM secret cipher using a master secret key.
// If secret is empty, it attempts to load or create a persistent salt key locally.
func NewVault(secret string) (*Vault, error) {
	var key [32]byte
	if secret != "" {
		key = sha256.Sum256([]byte(secret))
	} else {
		// Fallback to local machine secret if not provided in environment
		hostname, _ := os.Hostname()
		salt := fmt.Sprintf("omni-drive-vault-salt-%s", hostname)
		key = sha256.Sum256([]byte(salt))
	}
	return &Vault{key: key}, nil
}

// Encrypt encrypts plaintext using AES-256-GCM and returns standard Base64 string.
func (v *Vault) Encrypt(plaintext string) (string, error) {
	if plaintext == "" {
		return "", ErrEmptyPayload
	}

	block, err := aes.NewCipher(v.key[:])
	if err != nil {
		return "", fmt.Errorf("create aes cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("create gcm mode: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("generate nonce: %w", err)
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// Decrypt decrypts standard Base64 string encoded with AES-256-GCM.
func (v *Vault) Decrypt(encoded string) (string, error) {
	if encoded == "" {
		return "", nil
	}

	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", fmt.Errorf("base64 decode: %w", err)
	}

	block, err := aes.NewCipher(v.key[:])
	if err != nil {
		return "", fmt.Errorf("create aes cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("create gcm mode: %w", err)
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", ErrDecryptionFailed
	}

	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", ErrDecryptionFailed
	}

	return string(plaintext), nil
}
