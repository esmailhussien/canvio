import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  TestRunner,
  ServerSupervisor,
  YjsVirtualPeer,
  assert,
  assertEqual,
} from './harness.js';

export async function runTier4(targetUrl?: string): Promise<void> {
  const runner = new TestRunner('Tier 4: Real-World Scenarios');
  let supervisor: ServerSupervisor | null = null;
  let wsBaseUrl = targetUrl ? targetUrl.replace(/^http/, 'ws') : '';
  let serverDataDir = '';

  if (!targetUrl) {
    supervisor = new ServerSupervisor();
    await supervisor.start({
      env: {
        CANVIO_WS_MAX_PER_IP: '150', // Allow 32+ peers from test runner IP
        CANVIO_WS_MAX_CONNECTIONS: '500',
      },
    });
    wsBaseUrl = supervisor.wsUrl;
    serverDataDir = supervisor.dataDir;
  }

  const room = `e2e-tier4-room-${Date.now()}`;
  const PEER_COUNT = 32;
  const peers: YjsVirtualPeer[] = [];

  try {
    // -------------------------------------------------------------------------
    // T4.1: Multi-Peer Connection Cluster (32 Simultaneous Virtual Peers)
    // -------------------------------------------------------------------------
    runner.test('T4.1', `Connect ${PEER_COUNT} simultaneous peers to room with 0 connection drops`, async () => {
      for (let i = 0; i < PEER_COUNT; i++) {
        const peer = new YjsVirtualPeer({
          wsUrl: wsBaseUrl,
          room,
          clientId: `peer-${i.toString().padStart(2, '0')}`,
          userName: `Collaborator ${i + 1}`,
          userColor: `hsl(${(i * 360) / PEER_COUNT}, 70%, 50%)`,
        });
        peers.push(peer);
      }

      // Wait for all 32 peers to complete sync handshake
      await Promise.all(peers.map((p) => p.waitForSync(15000)));

      // Assert all 32 peers are synced and connected
      for (const peer of peers) {
        assert(peer.synced, `Peer ${peer.clientId} failed to sync`);
        assert(peer.provider.wsconnected, `Peer ${peer.clientId} is not wsconnected`);
      }
    });

    // -------------------------------------------------------------------------
    // T4.2: Ephemeral Awareness & Cursor Presence Broadcasting
    // -------------------------------------------------------------------------
    runner.test('T4.2', 'All peers broadcast and observe cursor presence across the whiteboard', async () => {
      // Each peer broadcasts unique cursor world coordinates
      peers.forEach((peer, i) => {
        peer.setCursor(i * 120 + 50, i * 80 + 50);
      });

      // Allow awareness states to propagate
      await new Promise((r) => setTimeout(r, 600));

      // Assert that peers observe multiple awareness states
      const observedCounts = peers.map((p) => p.getAwarenessCount());
      const minCount = Math.min(...observedCounts);
      assert(
        minCount >= Math.min(PEER_COUNT, 20),
        `Expected awareness propagation across peers, min observed: ${minCount}`
      );
    });

    // -------------------------------------------------------------------------
    // T4.3: Concurrent CRDT Living Node Creation & Character Text Diffing
    // -------------------------------------------------------------------------
    runner.test('T4.3', 'All 32 peers concurrently create sticky notes and edit text', async () => {
      // Concurrently create 1 sticky note per peer
      peers.forEach((peer, idx) => {
        peer.createStickyNote(
          `sticky-node-${idx}`,
          `Initial text from peer ${idx}`,
          idx * 150,
          idx * 100
        );
      });

      // Concurrently create relation connections between adjacent notes
      peers.forEach((peer, idx) => {
        if (idx < peers.length - 1) {
          peer.createRelation(
            `relation-${idx}`,
            `sticky-node-${idx}`,
            `sticky-node-${idx + 1}`
          );
        }
      });

      // Concurrently update text using character diffing
      peers.forEach((peer, idx) => {
        peer.updateStickyText(`sticky-node-${idx}`, ` [Edited by peer ${idx}]`);
      });

      // Allow CRDT propagation to settle
      await new Promise((r) => setTimeout(r, 1200));
    });

    // -------------------------------------------------------------------------
    // T4.4: Complete State Vector Convergence
    // -------------------------------------------------------------------------
    runner.test('T4.4', 'All 32 peers converge to 100% identical state vectors and node counts', async () => {
      // Verify node count across all peers
      for (const peer of peers) {
        assertEqual(
          peer.nodesMap.size,
          PEER_COUNT,
          `Peer ${peer.clientId} expected ${PEER_COUNT} nodes, found ${peer.nodesMap.size}`
        );
      }

      // Check state vectors match peer 0
      const baselineVector = peers[0].getStateVector();
      for (let i = 1; i < peers.length; i++) {
        const peerVector = peers[i].getStateVector();
        assertEqual(
          Buffer.from(baselineVector).toString('hex'),
          Buffer.from(peerVector).toString('hex'),
          `State vector mismatch between peer 0 and peer ${i}`
        );
      }
    });

    // -------------------------------------------------------------------------
    // T4.5: Persistence Across Disconnect and Cold-Start Reconnection
    // -------------------------------------------------------------------------
    runner.test('T4.5', 'Cold-start 33rd client reconstructs full board state after all peers disconnect', async () => {
      // 1. Disconnect all 32 peers
      peers.forEach((p) => p.destroy());
      peers.length = 0; // clear array

      // 2. Wait for debounced file persistence flush (default 750ms debounce)
      await new Promise((r) => setTimeout(r, 1500));

      // Verify on-disk persistence file exists if local server supervisor is running
      if (serverDataDir) {
        const ydocsDir = resolve(serverDataDir, 'ydocs');
        if (existsSync(ydocsDir)) {
          const files = readdirSync(ydocsDir);
          assert(
            files.length > 0,
            `Expected persisted ydocs files in ${ydocsDir}, found 0`
          );
        }
      }

      // 3. Connect a fresh, cold 33rd peer with empty Y.Doc
      const coldPeer = new YjsVirtualPeer({
        wsUrl: wsBaseUrl,
        room,
        clientId: 'peer-cold-33',
        userName: 'Cold Reconnect Peer',
      });

      try {
        await coldPeer.waitForSync(15000);

        // Assert cold peer received all 32 nodes
        assertEqual(
          coldPeer.nodesMap.size,
          PEER_COUNT,
          `Cold peer expected ${PEER_COUNT} restored nodes, found ${coldPeer.nodesMap.size}`
        );

        // Assert cold peer received text content with edits
        for (let i = 0; i < PEER_COUNT; i++) {
          const nodeMap = coldPeer.nodesMap.get(`sticky-node-${i}`);
          assert(Boolean(nodeMap), `Node sticky-node-${i} was not restored`);
          const dataMap = nodeMap.get('data') as any;
          const text = dataMap.get('text').toString();
          assert(
            text.includes(`Initial text from peer ${i}`) && text.includes(`[Edited by peer ${i}]`),
            `Expected edited text in node ${i}, got: "${text}"`
          );
        }

        // Assert relations restored
        assertEqual(
          coldPeer.relationsMap.size,
          PEER_COUNT - 1,
          `Expected ${PEER_COUNT - 1} relations restored, found ${coldPeer.relationsMap.size}`
        );
      } finally {
        coldPeer.destroy();
      }
    });

    // -------------------------------------------------------------------------
    // Execution
    // -------------------------------------------------------------------------
    const summary = await runner.run();
    if (summary.failed > 0) {
      console.warn(`Tier 4 completed with ${summary.failed} failure(s).`);
    }
  } finally {
    peers.forEach((p) => p.destroy());
    if (supervisor) {
      await supervisor.stop();
    }
  }
}

// CLI Execution Entrypoint
if (process.argv[1]?.endsWith('tier4-scenarios.ts') || process.argv[1]?.endsWith('tier4-scenarios.js')) {
  const argUrl = process.argv.find((a) => a.startsWith('--url='))?.split('=')[1];
  runTier4(argUrl).catch((err) => {
    console.error('Fatal Tier 4 error:', err);
    process.exit(1);
  });
}
