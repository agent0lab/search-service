'use client';

import { useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { WhitelistEntry } from '@/lib/types';
import { Trash2 } from 'lucide-react';

export default function WhitelistPage() {
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [newAddress, setNewAddress] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchWhitelist();
  }, []);

  const fetchWhitelist = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/whitelist');
      if (res.ok) {
        const data = await res.json();
        setWhitelist(data.whitelist);
      }
    } catch (error) {
      console.error('Failed to fetch whitelist:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newAddress || !/^0x[a-fA-F0-9]{40}$/.test(newAddress)) {
      alert('Invalid Ethereum address');
      return;
    }

    setAdding(true);
    try {
      const res = await fetch('/api/admin/whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: newAddress }),
      });

      if (res.ok) {
        setNewAddress('');
        fetchWhitelist();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to add address');
      }
    } catch (error) {
      console.error('Failed to add address:', error);
      alert('Failed to add address');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (address: string) => {
    if (!confirm(`Remove ${address} from whitelist?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/whitelist?address=${encodeURIComponent(address)}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchWhitelist();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to remove address');
      }
    } catch (error) {
      console.error('Failed to remove address:', error);
      alert('Failed to remove address');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Whitelist Management</h2>
        <p className="text-muted-foreground">Manage admin wallet whitelist</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Address</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="0x..."
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              className="font-mono"
            />
            <Button onClick={handleAdd} disabled={adding || !newAddress}>
              {adding ? 'Adding...' : 'Add'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Whitelisted Addresses ({whitelist.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div>Loading...</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Address</TableHead>
                    <TableHead>Added At</TableHead>
                    <TableHead>Added By</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {whitelist.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-mono">{entry.wallet_address}</TableCell>
                      <TableCell>
                        {new Date(entry.added_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {entry.added_by}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemove(entry.wallet_address)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

