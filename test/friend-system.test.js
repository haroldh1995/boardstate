import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultProfile } from "../src/state/schema.js";
import { reduceProfile } from "../src/state/gameReducer.js";
import { createFriendSyncManager } from "../src/multiplayer/friendSyncManager.js";
import { buildFriendInviteLink, generateFriendCode, isSafeFriendCode, isValidFriendCode, normalizeFriendCode } from "../src/social/friendSystem.js";

test("friend codes are short uppercase safe codes and can be regenerated", () => {
  const profile = createDefaultProfile();
  assert.match(profile.friends.myFriendCode, /^[A-Z0-9]{4,6}$/);
  assert.equal(isValidFriendCode(profile.friends.myFriendCode), true);
  assert.equal(isSafeFriendCode("NAZI"), false);
  assert.notEqual(generateFriendCode("NAZI"), "NAZI");
  assert.equal(normalizeFriendCode(" mage-4 "), "MAGE4");

  let next = reduceProfile(profile, { type: "FRIEND_REGENERATE_CODE", seed: "BOLT9" });
  assert.equal(next.friends.myFriendCode, "BOLT9");
  assert.ok(next.friends.friendCodeUpdatedAt >= profile.friends.friendCodeUpdatedAt);
});

test("friend list actions persist add favorite remove block states locally", () => {
  let profile = createDefaultProfile();
  profile = reduceProfile(profile, { type: "FRIEND_ADD_BY_CODE", friendCode: "DRGN4", displayName: "Dragon Mage" });
  assert.equal(profile.friends.friends.length, 1);
  const friend = profile.friends.friends[0];
  assert.equal(friend.friendCode, "DRGN4");

  profile = reduceProfile(profile, { type: "FRIEND_ADD_BY_CODE", friendCode: "DRGN4", displayName: "Duplicate" });
  assert.equal(profile.friends.friends.length, 1);
  assert.match(profile.friends.lastError, /Already friends/);

  profile = reduceProfile(profile, { type: "FRIEND_TOGGLE_FAVORITE", friendId: friend.friendId });
  assert.ok(profile.friends.favoriteFriendIds.includes(friend.friendId));
  assert.equal(profile.friends.friends[0].favorite, true);

  profile = reduceProfile(profile, { type: "FRIEND_BLOCK", friendId: friend.friendId, friendCode: friend.friendCode });
  assert.equal(profile.friends.friends.length, 0);
  assert.ok(profile.friends.blockedFriendCodes.includes("DRGN4"));

  profile = reduceProfile(profile, { type: "FRIEND_ADD_BY_CODE", friendCode: "DRGN4", displayName: "Blocked" });
  assert.equal(profile.friends.friends.length, 0);
  assert.match(profile.friends.lastError, /blocked/i);
});

test("friend notifications respect friend event preferences", () => {
  let profile = reduceProfile(createDefaultProfile(), {
    type: "SET_SETTING",
    path: "notifications.friendEvents.friendAccepted",
    value: false,
  });
  profile = reduceProfile(profile, { type: "FRIEND_ADD_BY_CODE", friendCode: "MAGE5", displayName: "Mage" });
  assert.equal(profile.notifications.items.some((entry) => entry.category === "friend" && entry.eventKey === "friendAccepted"), false);

  profile = reduceProfile(profile, {
    type: "NOTIFICATION_ADD",
    category: "friend",
    eventKey: "gameInvite",
    title: "Friend Game Invite",
    body: "Join?",
  });
  assert.equal(profile.notifications.items.some((entry) => entry.eventKey === "gameInvite"), true);
});

test("incoming friend requests populate pending requests before accept or decline", () => {
  let profile = createDefaultProfile();
  profile = reduceProfile(profile, { type: "FRIEND_RECEIVE_REQUEST", friendCode: "HEX7", displayName: "Hex Friend", source: "wifi-relay" });
  assert.equal(profile.friends.pendingFriendRequests.length, 1);
  assert.equal(profile.friends.pendingFriendRequests[0].friendCode, "HEX7");
  assert.equal(profile.notifications.items.some((entry) => entry.eventKey === "friendRequest"), true);

  profile = reduceProfile(profile, { type: "FRIEND_ACCEPT_REQUEST", friendCode: "HEX7" });
  assert.equal(profile.friends.pendingFriendRequests.length, 0);
  assert.equal(profile.friends.friends.some((friend) => friend.friendCode === "HEX7"), true);
});

test("friend game and tournament join shortcuts stay in their own destination flows", () => {
  let profile = createDefaultProfile();
  profile = reduceProfile(profile, { type: "FRIEND_JOIN_GAME", sessionId: "room-123", syncMode: "local" });
  assert.equal(profile.settings.multiplayer.roomId, "room-123");
  assert.equal(profile.settings.multiplayer.mode, "local");
  assert.equal(profile.tournament.status, "idle");

  profile = reduceProfile(profile, { type: "FRIEND_JOIN_TOURNAMENT", sessionId: "MTG-FRIEND", playerName: "Player", syncMode: "local" });
  assert.equal(profile.tournament.joinCode, "MTG-FRIEND");
  assert.equal(profile.tournament.sync.namespace, "tournament");
  assert.equal(profile.settings.multiplayer.roomId, "room-123");
});

test("friend invite links expose only session IDs and no private profile fields", () => {
  const gameLink = buildFriendInviteLink({ inviteType: "game", sessionId: "ROOM7" }, { origin: "https://example.test", pathname: "/boardstate/" });
  const tournamentLink = buildFriendInviteLink({ inviteType: "tournament", sessionId: "MTG777" }, { origin: "https://example.test", pathname: "/boardstate/" });
  assert.equal(gameLink, "https://example.test/boardstate/#game/join/ROOM7");
  assert.equal(tournamentLink, "https://example.test/boardstate/#tournament/join/MTG777");
  assert.doesNotMatch(gameLink + tournamentLink, /password|token|protected-profile/i);
});

test("friend WiFi sync uses separate friend namespace packets", () => {
  const originalWebSocket = globalThis.WebSocket;
  const sent = [];
  class FakeWebSocket {
    static OPEN = 1;
    static instances = [];
    constructor(url) {
      this.url = url;
      this.readyState = FakeWebSocket.OPEN;
      FakeWebSocket.instances.push(this);
    }
    send(payload) {
      sent.push(JSON.parse(payload));
    }
    close() {
      this.readyState = 3;
    }
  }
  FakeWebSocket.prototype.OPEN = 1;
  globalThis.WebSocket = FakeWebSocket;
  try {
    const profile = {
      ...createDefaultProfile(),
      settings: {
        ...createDefaultProfile().settings,
        multiplayer: {
          ...createDefaultProfile().settings.multiplayer,
          mode: "wifi",
          roomId: "LGS",
          wsUrl: "ws://lan-host:8787",
        },
      },
    };
    const manager = createFriendSyncManager();
    manager.configure(profile, profile.settings.multiplayer);
    FakeWebSocket.instances[0].onopen();
    manager.sendAction({ actionType: "FRIEND_INVITE_GAME", actionId: "friend-action-1" }, profile);
    assert.equal(sent[0].type, "join");
    assert.equal(sent[0].namespace, "friend");
    assert.equal(sent[0].roomId, "friend:LGS");
    assert.equal(sent[1].type, "friend-presence");
    assert.equal(sent[1].namespace, "friend");
    assert.equal(sent[2].type, "friend-message");
    assert.equal(sent[2].namespace, "friend");
    assert.equal(sent[2].messageType, "friend:game-invite");
    assert.notEqual(sent[2].type, "action");
    assert.notEqual(sent[2].type, "tournament-action");
    manager.teardown();
  } finally {
    globalThis.WebSocket = originalWebSocket;
  }
});
