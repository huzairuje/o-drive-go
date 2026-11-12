package gdrive

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"golang.org/x/oauth2/google"
)

type Credentials struct {
	ClientID     string `json:"client_id,omitempty"`
	ClientSecret string `json:"client_secret,omitempty"`
	RefreshToken string `json:"refresh_token,omitempty"`
	AccessToken  string `json:"access_token,omitempty"`
	ExpiresAt    int64  `json:"expires_at,omitempty"` // Unix timestamp in seconds

	// Optional Service Account
	ServiceAccountJSON string `json:"service_account_json,omitempty"`
}

type TokenManager struct {
	mu    sync.Mutex
	creds Credentials
}

func NewTokenManager(creds Credentials) *TokenManager {
	return &TokenManager{creds: creds}
}

// GetToken returns a valid access token, refreshing if within 60 seconds of expiration.
func (tm *TokenManager) GetToken(ctx context.Context) (string, error) {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	now := time.Now().Unix()
	if tm.creds.AccessToken != "" && tm.creds.ExpiresAt > now+60 {
		return tm.creds.AccessToken, nil
	}

	// 1. Service Account JSON flow
	if tm.creds.ServiceAccountJSON != "" {
		cfg, err := google.JWTConfigFromJSON([]byte(tm.creds.ServiceAccountJSON), "https://www.googleapis.com/auth/drive")
		if err != nil {
			return "", fmt.Errorf("parse service account json: %w", err)
		}
		tok, err := cfg.TokenSource(ctx).Token()
		if err != nil {
			return "", fmt.Errorf("get service account token: %w", err)
		}
		tm.creds.AccessToken = tok.AccessToken
		tm.creds.ExpiresAt = tok.Expiry.Unix()
		return tm.creds.AccessToken, nil
	}

	// 2. OAuth2 Refresh Token flow
	if tm.creds.RefreshToken == "" {
		if tm.creds.AccessToken != "" {
			return tm.creds.AccessToken, nil
		}
		return "", fmt.Errorf("no refresh token or access token available")
	}

	// Refresh token via Google OAuth2
	data := url.Values{}
	data.Set("client_id", tm.creds.ClientID)
	data.Set("client_secret", tm.creds.ClientSecret)
	data.Set("refresh_token", tm.creds.RefreshToken)
	data.Set("grant_type", "refresh_token")

	req, err := http.NewRequestWithContext(ctx, "POST", "https://oauth2.googleapis.com/token", strings.NewReader(data.Encode()))
	if err != nil {
		return "", fmt.Errorf("create refresh request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("execute token refresh: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("token refresh failed with status %d", resp.StatusCode)
	}

	var res struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int64  `json:"expires_in"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return "", fmt.Errorf("decode token refresh response: %w", err)
	}

	tm.creds.AccessToken = res.AccessToken
	tm.creds.ExpiresAt = time.Now().Unix() + res.ExpiresIn
	return tm.creds.AccessToken, nil
}

func (tm *TokenManager) CurrentCredentials() Credentials {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	return tm.creds
}
