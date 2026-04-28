// =====================================================
// GITHUB INTEGRATION HOOKS
// =====================================================
// NO UI CHANGE • ONLY BACKEND INTEGRATION
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { githubApi, GitHubAccount, GitHubRepo, RepoScanResult } from '@/lib/githubApi';

// =====================================================
// GITHUB ACCOUNTS HOOK
// =====================================================

export function useGitHubAccounts() {
  const [accounts, setAccounts] = useState<GitHubAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await githubApi.getAccounts();
      setAccounts(data);
    } catch (error) {
      console.error('Error fetching GitHub accounts:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const connectAccount = useCallback(async (code: string) => {
    try {
      const account = await githubApi.connectAccount(code);
      setAccounts(prev => [...prev, account]);
      toast.success('GitHub account connected');
      return account;
    } catch (error) {
      toast.error('Failed to connect GitHub account');
      throw error;
    }
  }, []);

  const deleteAccount = useCallback(async (accountId: string) => {
    try {
      await githubApi.deleteAccount(accountId);
      setAccounts(prev => prev.filter(a => a.id !== accountId));
      toast.success('GitHub account disconnected');
    } catch (error) {
      toast.error('Failed to disconnect GitHub account');
      throw error;
    }
  }, []);

  return { accounts, loading, fetchAccounts, connectAccount, deleteAccount };
}

// =====================================================
// GITHUB REPOS HOOK
// =====================================================

export function useGitHubRepos(accountId: string) {
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRepos = useCallback(async () => {
    if (!accountId) return;
    
    setLoading(true);
    try {
      const data = await githubApi.getRepos(accountId);
      setRepos(data);
    } catch (error) {
      console.error('Error fetching GitHub repos:', error);
      toast.error('Failed to fetch repositories');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    fetchRepos();
  }, [fetchRepos]);

  return { repos, loading, fetchRepos };
}

// =====================================================
// GITHUB REPO SCANNER HOOK
// =====================================================

export function useGitHubRepoScan() {
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<RepoScanResult | null>(null);

  const scanRepo = useCallback(async (accountId: string, owner: string, repo: string) => {
    setScanning(true);
    try {
      const result = await githubApi.scanRepo(accountId, owner, repo);
      setScanResult(result);
      return result;
    } catch (error) {
      console.error('Error scanning repo:', error);
      toast.error('Failed to scan repository');
      throw error;
    } finally {
      setScanning(false);
    }
  }, []);

  return { scanning, scanResult, scanRepo };
}

// =====================================================
// GITHUB IMPORT HOOK
// =====================================================

export function useGitHubImport() {
  const [importing, setImporting] = useState(false);

  const importRepo = useCallback(async (accountId: string, owner: string, repo: string) => {
    setImporting(true);
    try {
      const product = await githubApi.importRepo(accountId, owner, repo);
      toast.success('Repository imported successfully');
      return product;
    } catch (error) {
      console.error('Error importing repo:', error);
      toast.error('Failed to import repository');
      throw error;
    } finally {
      setImporting(false);
    }
  }, []);

  return { importing, importRepo };
}

// =====================================================
// GITHUB OAUTH HOOK
// =====================================================

export function useGitHubOAuth() {
  const [isConnecting, setIsConnecting] = useState(false);

  const initiateOAuth = useCallback(() => {
    // GitHub OAuth configuration
    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID || '';
    const redirectUri = `${window.location.origin}/github/callback`;
    const scope = 'repo read:user';
    
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`;
    
    window.location.href = authUrl;
  }, []);

  const handleCallback = useCallback(async (code: string) => {
    setIsConnecting(true);
    try {
      // Exchange code for access token (server-side)
      // For now, we'll use the code directly
      const response = await fetch('/api/github/oauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        throw new Error('OAuth failed');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('OAuth error:', error);
      toast.error('GitHub authentication failed');
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  return { isConnecting, initiateOAuth, handleCallback };
}
