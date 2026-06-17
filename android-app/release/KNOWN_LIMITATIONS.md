# Known Limitations

- Auto-mana safely resolves basic and clearly parsed mana abilities. Hybrid/Phyrexian/snow/alternate costs, unusual multi-output sources, and ambiguous restrictions remain Manual Choice Required.
- Spacecraft, Station, Planet, Mount, Vehicle, and Max Speed state is tracked, but card-specific text that cannot be parsed deterministically remains Manual Choice Required rather than being silently resolved.

- iOS/App Store packaging is not produced from this Android Studio project.
- Google Play production signing with Play App Signing is not configured here because it requires owner account setup in Play Console.
- Device/emulator runtime validation depends on installed Android system images or connected devices.
- Remote-hosted mode depends on network availability and GitHub Pages uptime.
- BoardState is a companion and calculation aid, not a complete Magic rules engine or tournament judge. Complex replacement effects, continuous interactions, first/double-strike ordering, protection/ward edge cases, and unusual combat-damage assignment can still require Manual Choice Required.
- Arbitrary live Scryfall search depends on browser/network CORS availability or a previously cached result. Common event-use cards have an embedded fallback catalog so Deck and Battlefield search remain usable when the remote API is blocked.
- Tournament sync supports same-origin local tabs and a separate WiFi WebSocket relay on the host LAN. Cross-device tournament sync requires running `npm run multiplayer:server` on a reachable host and entering that relay URL; cloud join-code discovery and internet relay hosting are not included.
- Tournament invite links carry only the join code/session ID. Live cross-device joining still depends on the same local WiFi relay setup; without a reachable relay, invite joins create or update local tournament state only.
- Friend Nearby discovery uses browser-supported same-origin channels and the existing WiFi relay room. True no-code automatic LAN discovery between independent browsers is limited by web platform restrictions, so cross-device friend discovery requires the WiFi relay server or the friend code/invite-link fallback.
- Friend codes and invite links intentionally expose only short public codes or session IDs. They do not carry private profile passwords, local tokens, or hidden debug state.
- Browser notification sounds require a prior user interaction in some browsers, and haptics require `navigator.vibrate` support on the device/browser. Unsupported sound or haptic delivery is a safe no-op.
- NPCs make their own supported choices, but AI strategy learning, NPC responses, user blocker prompts against every NPC attack, and unsupported oracle-text decisions remain heuristic/partial.
- Crew, Saddle, Station, Convoke, and Improvise provide validated tap-cost helpers plus Manual Choice confirmation; they do not automate every card-specific exception or duration interaction.
- iOS wrapper metadata is updated, but an iOS/App Store build was not produced in this Windows environment.
