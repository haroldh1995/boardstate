import { WebSocketServer } from "ws";

const port = Number(process.env.BOARDSTATE_MULTIPLAYER_PORT || 8787);
const rooms = new Map();

const server = new WebSocketServer({ port });
console.log(`BoardState multiplayer relay listening on ws://0.0.0.0:${port}`);

server.on("connection", (socket) => {
  let currentRoom = "";
  let peerId = "";
  let role = "player";

  socket.on("message", (raw) => {
    let message = null;
    try {
      message = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (!message?.type) {
      return;
    }
    if (message.type === "join") {
      currentRoom = message.roomId || "boardstate-room";
      peerId = message.peerId || `peer-${Math.random().toString(36).slice(2, 8)}`;
      role = message.role || "player";
      if (!rooms.has(currentRoom)) {
        rooms.set(currentRoom, new Map());
      }
      rooms.get(currentRoom).set(socket, { peerId, role });
      broadcastPresence(currentRoom);
      return;
    }

    if (!currentRoom || !rooms.has(currentRoom)) {
      return;
    }
    if (message.type === "action") {
      broadcast(currentRoom, socket, message);
    }
  });

  socket.on("close", () => {
    if (!currentRoom || !rooms.has(currentRoom)) {
      return;
    }
    rooms.get(currentRoom).delete(socket);
    if (!rooms.get(currentRoom).size) {
      rooms.delete(currentRoom);
      return;
    }
    broadcastPresence(currentRoom);
  });
});

function broadcast(roomId, sender, payload) {
  const room = rooms.get(roomId);
  if (!room) {
    return;
  }
  const serialized = JSON.stringify(payload);
  for (const client of room.keys()) {
    if (client === sender || client.readyState !== client.OPEN) {
      continue;
    }
    client.send(serialized);
  }
}

function broadcastPresence(roomId) {
  const room = rooms.get(roomId);
  if (!room) {
    return;
  }
  const peers = [...room.values()].map((entry) => ({
    id: entry.peerId,
    name: entry.peerId,
    role: entry.role,
  }));
  const payload = JSON.stringify({ type: "presence", roomId, peers });
  for (const client of room.keys()) {
    if (client.readyState === client.OPEN) {
      client.send(payload);
    }
  }
}
