package crypto

import (
	"testing"
)

func TestVaultEncryptDecrypt(t *testing.T) {
	vault, err := NewVault("my-secure-master-password-123")
	if err != nil {
		t.Fatalf("NewVault failed: %v", err)
	}

	rawSecrets := `{"client_id":"foo","client_secret":"bar","refresh_token":"1/xyz"}`
	encrypted, err := vault.Encrypt(rawSecrets)
	if err != nil {
		t.Fatalf("Encrypt failed: %v", err)
	}

	if encrypted == rawSecrets {
		t.Fatalf("Ciphertext equals plaintext!")
	}

	decrypted, err := vault.Decrypt(encrypted)
	if err != nil {
		t.Fatalf("Decrypt failed: %v", err)
	}

	if decrypted != rawSecrets {
		t.Fatalf("Decrypted mismatch. Expected: %s, got: %s", rawSecrets, decrypted)
	}
}

func TestVaultCorruptedPayload(t *testing.T) {
	vault, _ := NewVault("secure-key")
	_, err := vault.Decrypt("invalid-base64-random-string!!!")
	if err == nil {
		t.Fatalf("Expected error on invalid payload, got nil")
	}
}
