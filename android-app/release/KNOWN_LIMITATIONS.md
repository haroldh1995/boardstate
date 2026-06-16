# Known Limitations

- Auto-mana safely resolves basic and clearly parsed mana abilities. Hybrid/Phyrexian/snow/alternate costs, unusual multi-output sources, and ambiguous restrictions remain Manual Choice Required.
- Spacecraft, Station, Planet, Mount, Vehicle, and Max Speed state is tracked, but card-specific text that cannot be parsed deterministically remains Manual Choice Required rather than being silently resolved.

- iOS/App Store packaging is not produced from this Android Studio project.
- Google Play production signing with Play App Signing is not configured here because it requires owner account setup in Play Console.
- Device/emulator runtime validation depends on installed Android system images or connected devices.
- Remote-hosted mode depends on network availability and GitHub Pages uptime.
- BoardState is a companion and calculation aid, not a complete Magic rules engine or tournament judge. Complex replacement effects, continuous interactions, first/double-strike ordering, protection/ward edge cases, and unusual combat-damage assignment can still require Manual Choice Required.
- Arbitrary live Scryfall search depends on browser/network CORS availability or a previously cached result. Common event-use cards have an embedded fallback catalog so Deck and Battlefield search remain usable when the remote API is blocked.
- Tournament sync uses a separate same-origin BroadcastChannel adapter and local persistence. Cross-device real-time tournament transport, cloud join-code discovery, and synced cast-preview timing were not validated in this release.
- NPCs make their own supported choices, but AI strategy learning, NPC responses, user blocker prompts against every NPC attack, and unsupported oracle-text decisions remain heuristic/partial.
- Crew, Saddle, Station, Convoke, and Improvise provide validated tap-cost helpers plus Manual Choice confirmation; they do not automate every card-specific exception or duration interaction.
- iOS wrapper metadata is updated, but an iOS/App Store build was not produced in this Windows environment.
