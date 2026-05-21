(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),e.crossOrigin===`use-credentials`?t.credentials=`include`:e.crossOrigin===`anonymous`?t.credentials=`omit`:t.credentials=`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();function e(e=`id`){let t=Math.random().toString(36).slice(2,10);return`${e}_${Date.now().toString(36)}_${t}`}function t(e,t=``){return String(e||t).trim()}function n(e,t=0){let n=Number(e);return Number.isFinite(n)?Math.max(0,Math.trunc(n)):t}function r(e,t=0){let n=Number(e);return Number.isFinite(n)?Math.trunc(n):t}function i(e){return typeof structuredClone==`function`?structuredClone(e):JSON.parse(JSON.stringify(e))}var a=[`Beginning`,`Main 1`,`Combat`,`Main 2`,`Ending`],o=[`setup`,`mulligan`,`untap`,`upkeep`,`draw`,`precombatMain`,`combatBeginning`,`attackers`,`blockers`,`damage`,`combatEnd`,`postcombatMain`,`ending`,`cleanup`],s=o.reduce((e,t,n)=>(e[t]=o[(n+1)%o.length],e),{});s.cleanup=`untap`;var c={setup:`Beginning`,mulligan:`Beginning`,untap:`Beginning`,upkeep:`Beginning`,draw:`Beginning`,precombatMain:`Main 1`,combatBeginning:`Combat`,attackers:`Combat`,blockers:`Combat`,damage:`Combat`,combatEnd:`Combat`,postcombatMain:`Main 2`,ending:`Ending`,cleanup:`Ending`};function l(){return{current:`setup`,previous:``,transitions:[]}}function u(e,t){return s[e]===t}function d(e,t=``){let n=e.fsm?.current||`setup`,r=n===`cleanup`?`untap`:s[n]||`setup`,i=t&&u(n,t)?t:r,o=n,l=[{at:Date.now(),from:o,to:i},...e.fsm?.transitions||[]].slice(0,240),d=c[i]||`Beginning`,f=Math.max(0,a.indexOf(d)),p=i===`untap`&&o===`cleanup`?e.turn+1:e.turn;return{...e,turn:p,phaseIndex:f,phaseStartedAt:Date.now(),turnStartedAt:p===e.turn?e.turnStartedAt:Date.now(),fsm:{current:i,previous:o,transitions:l}}}var f=[`Beginning`,`Main 1`,`Combat`,`Main 2`,`Ending`],p=[`W`,`U`,`B`,`R`,`G`,`C`,`Generic`],m={BATTLEFIELD:`battlefield`,COMMAND:`command`,HIDDEN_PLACEHOLDER:`hidden-placeholder`};function h(){return{id:e(`profile`),version:1,player:{id:`local-player`,name:`Player`,avatarAccent:`azure`},settings:{adhdAutomation:!0,adhdMode:{enabled:!1,triggerReminders:!0,missedTriggerReminders:!0,legalityHints:!0,targetingReminders:!0,stackExplanation:!0,layerExplanation:!0,triggerChainView:!0,replayDebugInfo:!0,stateInspector:!0,focusedGuidance:!0,reducedNoise:!0,highlightLikelyActions:!0,phaseActionReminders:!0,unresolvedReminders:!0,resourceReminders:!0,stepByStepPrompts:!1},confirmAmbiguousEffects:!0,haptics:!1,compactTiles:!0,pagePanels:{lifeTrackerLife:!0,lifeTrackerMana:!0,lifeTrackerTools:!0,boardOpponent:!0,boardCombat:!0,boardTools:!0,advancedRulesHelpers:!0,archiveQuickAdd:!0,statsTimerWidgets:!0},multiplayer:{mode:`offline`,connectedPlayers:[],authorityMode:`confirm`,confirmAuthority:!0,bluetoothReady:!1,wifiReady:!0,roomId:`boardstate-room`,wsUrl:`ws://localhost:8787`,role:`player`,spectatorMode:!1,selectedSimulatedOpponents:[`alpha`],simulatedSpeed:`normal`},battlefield:{manaPinned:!1,expandedAll:!1,detailMode:`standard`,compressionMode:`adaptive`,densityScale:1,focusMode:!0},appearance:{compositionMode:`auto`},navigation:{showProfileInMainUi:!1,edgeSwipeShortcuts:!0},gestures:{advanced:!0},helperSprite:{enabled:!1,remindersAtUpkeep:!0}},localAuth:{mode:`guest`,locked:!1,hasPassword:!1},activeSession:g(),commanders:{},archives:[],leaderboards:C(),achievements:[],statsSync:{lastSyncedAt:0,publicSummary:{},peers:[]},simulationMemory:{patterns:{tokenStrategy:0,landfallStrategy:0,lifegainStrategy:0,commanderDamageStrategy:0,graveyardRecursionStrategy:0,artifactsStrategy:0,enchantmentsStrategy:0,comboEngineStrategy:0,fastManaStrategy:0,boardWipeStrategy:0},cardThreat:{},repeatedWinConditions:{},updatedAt:0}}}function g(){let t=Date.now();return{id:e(`game`),createdAt:t,updatedAt:t,turn:1,phaseIndex:0,phaseStartedAt:t,turnStartedAt:t,timer:{gameStartedAt:t,phaseDurations:{},turnDurations:[],combatMs:0},life:40,playerCounters:{},manaPool:_(),selectedIds:[],commander:y(),battlefield:{player:[],opponent:[],invisiblePlaceholders:{hand:!0,library:!0,graveyard:!0,exile:!0}},combat:v(),pendingEffects:[],triggerQueue:[],effectLog:[],history:[],undoStack:[],redoStack:[],actionHistory:[],eventQueue:[],eventHistory:[],fsm:l(),replay:{active:!1,cursor:-1,running:!1},gameTracking:{active:!1,startedAt:0,mode:`training-ground`},helper:{reminderRequested:!1,reminderRequestedTurn:0,reminderQueue:[],replayQueue:[],dismissedKeys:[],deliveredKeys:[],lastKey:``,lastShownAt:0},simulation:{enabled:!1,status:`idle`,speed:`normal`,selectedOpponents:[],opponents:{},turnOrder:[],turnIndex:0,currentPlayerId:`local-player`,currentPhaseIndex:0,round:1,waitingForUser:!1,log:[],createdAt:0,updatedAt:0}}}function _(){return p.reduce((e,t)=>(e[t]=0,e),{})}function v(){return{step:`idle`,attackerIds:[],blockersByAttacker:{},damagePreview:null,resolvedDamage:0,lines:[]}}function y(e={}){return{name:t(e.name),cardId:t(e.cardId),colorIdentity:Array.isArray(e.colorIdentity)?e.colorIdentity:[],zone:t(e.zone,`none`),castCount:n(e.castCount),commanderTax:n(e.commanderTax),damageByOpponent:e.damageByOpponent||{},deckKey:t(e.deckKey)}}function b(i={}){let a=t(i.typeLine,`Permanent`),o=i.isCreature??/\bCreature\b/i.test(a),s=i.isArtifact??/\bArtifact\b/i.test(a),c=i.isEnchantment??/\bEnchantment\b/i.test(a),l=i.isAura??/\bAura\b/i.test(a),u=i.isEquipment??/\bEquipment\b/i.test(a),d=i.isPlaneswalker??/\bPlaneswalker\b/i.test(a),f=i.isLand??/\bLand\b/i.test(a),p=i.isInstant??/\bInstant\b/i.test(a),h=i.isSorcery??/\bSorcery\b/i.test(a),g=!!i.isToken,_=r(i.basePower??i.power),v=r(i.baseToughness??i.toughness),y=Array.isArray(i.stackMembers)&&i.stackMembers.length?i.stackMembers:Array.from({length:Math.max(1,n(i.quantity,1))},(t,n)=>({instanceId:i.instanceId||`${i.id||e(`perm`)}:member:${n+1}`,tapped:!!i.tapped,attacking:!!i.attacking,blocking:!!i.blocking,summoningSick:i.summoningSick??!!o,counters:{...i.counters||{}},attachments:Array.isArray(i.attachments)?[...i.attachments]:[],temporaryModifiers:Array.isArray(i.temporaryModifiers)?[...i.temporaryModifiers]:[],metadata:{...i.memberMetadata||{},enteredDuringCombat:!!i.enteredDuringCombat,attackingPlayerId:i.attackingPlayerId||``,attackedObjectId:i.attackedObjectId||``,createdByTriggerId:i.createdByTriggerId||``,sourcePermanentId:i.sourcePermanentId||``,combatPhaseCreatedIn:i.combatPhaseCreatedIn||``,tokenTemplateId:i.tokenTemplateId||``,tokenCopyOfId:i.tokenCopyOfId||``}}));return{id:t(i.id,e(`perm`)),cardId:t(i.cardId||i.scryfallId),name:t(i.name,`Permanent`),manaCost:t(i.manaCost),manaValue:Number.isFinite(Number(i.manaValue))?Number(i.manaValue):0,typeLine:a,subtypes:Array.isArray(i.subtypes)?i.subtypes:[],supertypes:Array.isArray(i.supertypes)?i.supertypes:[],colors:Array.isArray(i.colors)?i.colors:[],oracleText:t(i.oracleText),rulesText:t(i.rulesText||i.oracleText),flavorText:t(i.flavorText),imageUrl:t(i.imageUrl),legalities:i.legalities||{},colorIdentity:Array.isArray(i.colorIdentity)?i.colorIdentity:[],owner:t(i.owner,`player`),controller:t(i.controller,`player`),ownedByCommanderDeck:i.ownedByCommanderDeck!==!1,zone:t(i.zone,m.BATTLEFIELD),quantity:Math.max(1,n(i.quantity,1)),isCreature:o,isArtifact:s,isEnchantment:c,isAura:l,isEquipment:u,isPlaneswalker:d,isLand:f,isInstant:p,isSorcery:h,isToken:g,isCopy:!!i.isCopy,isCommander:!!i.isCommander,basePower:_,baseToughness:v,currentPower:r(i.currentPower,_),currentToughness:r(i.currentToughness,v),counters:i.counters||{},keywords:Array.isArray(i.keywords)?i.keywords:[],tapped:!!i.tapped,summoningSick:i.summoningSick??!!o,attacking:!!i.attacking,blocking:!!i.blocking,enteredDuringCombat:!!i.enteredDuringCombat,attackingPlayerId:t(i.attackingPlayerId),attackedObjectId:t(i.attackedObjectId),createdByTriggerId:t(i.createdByTriggerId),sourcePermanentId:t(i.sourcePermanentId),combatPhaseCreatedIn:t(i.combatPhaseCreatedIn),tokenTemplateId:t(i.tokenTemplateId),tokenCopyOfId:t(i.tokenCopyOfId),attachedToId:t(i.attachedToId),attachments:Array.isArray(i.attachments)?i.attachments:[],temporaryModifiers:Array.isArray(i.temporaryModifiers)?i.temporaryModifiers:[],parsedEffects:Array.isArray(i.parsedEffects)?i.parsedEffects:[],staticAbilities:Array.isArray(i.staticAbilities)?i.staticAbilities:[],activatedAbilities:Array.isArray(i.activatedAbilities)?i.activatedAbilities:[],triggeredAbilities:Array.isArray(i.triggeredAbilities)?i.triggeredAbilities:[],replacementEffects:Array.isArray(i.replacementEffects)?i.replacementEffects:[],continuousEffects:Array.isArray(i.continuousEffects)?i.continuousEffects:[],tokenDefinitions:Array.isArray(i.tokenDefinitions)?i.tokenDefinitions:[],metadata:i.metadata||{},relationships:i.relationships||{},tags:Array.isArray(i.tags)?i.tags:[],layerBreakdown:Array.isArray(i.layerBreakdown)?i.layerBreakdown:[],stackMembers:y,manualStatus:t(i.manualStatus)}}function x(e){return{key:e.deckKey||S(e.name),commanderName:e.name,colorIdentity:e.colorIdentity||[],cards:[],usage:{},games:[],stats:{gamesPlayed:0,wins:0,losses:0,commanderDamage:0,averageGameMs:0},evolution:[]}}function S(e){return t(e,`commander`).toLowerCase().replace(/[^a-z0-9]+/g,`-`).replace(/^-|-$/g,``)}function C(){return{highestLife:[],largestManaPool:[],biggestCombatDamage:[],largestTokenArmy:[],longestGame:[],mostTriggers:[],biggestBoardState:[],highestCommanderDamage:[]}}function w(e){let t=e.archives||[],n=e.activeSession,r=[...n.battlefield.player,...n.battlefield.opponent],i=r.filter(e=>e.isToken),a=r.flatMap(e=>Object.entries(e.counters||{})),o=Object.values(n.manaPool||{}).reduce((e,t)=>e+t,0);return{gamesPlayed:t.length,actionsThisGame:n.history.length,currentBoardSize:r.length,highestLife:Math.max(n.life,...t.map(e=>e.summary?.highestLife||0)),largestTokenArmy:Math.max(i.reduce((e,t)=>e+t.quantity,0),...t.map(e=>e.summary?.largestTokenArmy||0)),counterTypes:ne(a),manaFloating:o,triggersResolved:n.effectLog.length,commanderCount:Object.keys(e.commanders||{}).length}}function ee(e){let t=w(e);return{...e,leaderboards:{...e.leaderboards,highestLife:te(e.leaderboards.highestLife,`Highest Life`,t.highestLife),largestTokenArmy:te(e.leaderboards.largestTokenArmy,`Largest Token Army`,t.largestTokenArmy),largestManaPool:te(e.leaderboards.largestManaPool,`Largest Mana Pool`,t.manaFloating),biggestBoardState:te(e.leaderboards.biggestBoardState,`Biggest Board`,t.currentBoardSize),mostTriggers:te(e.leaderboards.mostTriggers,`Most Triggers`,t.triggersResolved)}}}function te(e=[],t,n){return[...e,{label:t,value:n,at:Date.now()}].sort((e,t)=>t.value-e.value).slice(0,10)}function ne(e){return e.reduce((e,[t,n])=>(e[t]=(e[t]||0)+n,e),{})}function re(e,t=`completed`){let n=e.activeSession,r={id:n.id,commanderName:n.commander?.name||`No Commander`,result:t,endedAt:Date.now(),durationMs:Date.now()-n.createdAt,history:n.history,effectLog:n.effectLog,boardState:n.battlefield,combat:n.combat,summary:w(e)};return ee({...e,archives:[r,...e.archives||[]].slice(0,100),activeSession:g()})}function T(e,t,n=null,r={}){if(String(t||``).includes(`:`))return ie(e,t,n,r);let i=ae(e),a=new Set(e.selectedIds||[]),o=new Set(e.combat?.attackerIds||[]),s=E(t);return i.filter(e=>{switch(s){case`self`:return e.id===n?.id;case`attached`:return e.id===n?.attachedToId;case`selected`:return a.has(e.id);case`all-creatures`:return e.isCreature;case`your-creatures`:return e.isCreature&&e.controller===(n?.controller||`player`);case`your-permanents`:return e.controller===(n?.controller||`player`);case`your-tokens`:return e.isToken&&e.controller===(n?.controller||`player`);case`your-lands`:return e.isLand&&e.controller===(n?.controller||`player`);case`all-creature-tokens`:return e.isCreature&&e.isToken;case`all-tokens`:return e.isToken;case`all-attackers`:return e.isCreature&&o.has(e.id);case`all-artifacts`:return e.isArtifact;case`all-enchantments`:return e.isEnchantment;case`all-auras`:return e.isAura;case`all-equipment`:return e.isEquipment;case`all-planeswalkers`:return e.isPlaneswalker;case`all-lands`:return e.isLand;case`all-nonbasic-lands`:return e.isLand&&!/\bBasic\b/i.test(e.typeLine);case`all-permanents`:return!0;case`all-vehicles`:return/\bVehicle\b/i.test(e.typeLine);case`all-mounts`:return/\bMount\b/i.test(e.typeLine);case`all-spacecraft`:return/\bSpacecraft\b/i.test(e.typeLine);case`all-planets`:return/\bPlanet\b/i.test(e.typeLine);default:return e.isCreature}})}function ie(e,t,n=null,r={}){let i=ae(e),a=String(t||``).split(/\s+/).map(e=>e.trim()).filter(Boolean);return i.filter(t=>a.every(r=>{let[i,a=``]=r.split(`:`),o=a.toLowerCase();return i===`type`?String(t.typeLine||``).toLowerCase().includes(o):i===`controller`?o===`you`?t.controller===(n?.controller||`player`):o===`opponent`?t.controller!==(n?.controller||`player`):t.controller===o:i===`token`?o===`true`?!!t.isToken:!t.isToken:i===`keyword`?(t.keywords||[]).map(e=>e.toLowerCase()).includes(o):i===`selected`?(e.selectedIds||[]).includes(t.id):i===`zone`?String(t.zone||``).toLowerCase()===o:!0}))}function ae(e){return[...e.battlefield?.player||[],...e.battlefield?.opponent||[]]}function E(e){return String(e||`all-creatures`).trim().toLowerCase()}function oe(e,t=``){let n=D(e),r=D(t);return r&&(n.includes(`on ${r}`)||n.includes(`onto ${r}`))||n.includes(`on it`)||n.includes(`on itself`)?{target:`self`,manual:!1,entity:`permanent`}:n.includes(`equipped creature`)||n.includes(`enchanted creature`)?{target:`attached`,manual:!1,entity:`creature`}:n.includes(`each creature token`)||n.includes(`creature tokens you control`)?{target:`all-creature-tokens`,manual:!1,entity:`creature`}:n.includes(`creatures you control`)?{target:`your-creatures`,manual:!1,entity:`creature`}:n.includes(`tokens you control`)?{target:`your-tokens`,manual:!1,entity:`permanent`}:n.includes(`permanents you control`)?{target:`your-permanents`,manual:!1,entity:`permanent`}:n.includes(`lands you control`)?{target:`your-lands`,manual:!1,entity:`permanent`}:n.includes(`each creature`)||n.includes(`all creatures`)||n.includes(`creatures you control`)?{target:`all-creatures`,manual:!1,entity:`creature`}:n.includes(`each token`)||n.includes(`tokens you control`)?{target:`all-tokens`,manual:!1,entity:`permanent`}:n.includes(`each permanent`)||n.includes(`permanents you control`)?{target:`all-permanents`,manual:!1,entity:`permanent`}:n.includes(`each artifact`)||n.includes(`artifacts you control`)?{target:`all-artifacts`,manual:!1,entity:`permanent`}:n.includes(`each enchantment`)||n.includes(`enchantments you control`)?{target:`all-enchantments`,manual:!1,entity:`permanent`}:n.includes(`each planeswalker`)||n.includes(`planeswalkers you control`)?{target:`all-planeswalkers`,manual:!1,entity:`permanent`}:n.includes(`each nonbasic land`)?{target:`all-nonbasic-lands`,manual:!1,entity:`permanent`}:n.includes(`each land`)||n.includes(`lands you control`)?{target:`all-lands`,manual:!1,entity:`permanent`}:n.includes(`target permanent`)?{target:`selected`,manual:!0,entity:`permanent`}:n.includes(`target creature`)?{target:`selected`,manual:!0,entity:`creature`}:{target:`all-creatures`,manual:!1,entity:`creature`}}function D(e){return String(e||``).toLowerCase().replace(/[^a-z0-9+/\- ]+/g,` `).replace(/\s+/g,` `).trim()}var O={a:1,an:1,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10};function se(e){let t=D(e.oracleText);return t?[...ce(t,e),...k(t,e),...A(t,e)]:[]}function ce(e,t={}){let n=[],r=(e,r)=>{n.push({id:`${t.id||t.cardId||t.name}-static-${n.length}`,kind:`static`,action:`modify-power-toughness`,target:r,power:Number(e[1])||0,toughness:Number(e[2])||0,sourceName:t.name})};for(let t of e.matchAll(/creatures you control get ([+\-]\d+)\/([+\-]\d+)/g))r(t,`all-creatures`);for(let t of e.matchAll(/all creatures get ([+\-]\d+)\/([+\-]\d+)/g))r(t,`all-creatures`);for(let t of e.matchAll(/creature tokens you control get ([+\-]\d+)\/([+\-]\d+)/g))r(t,`all-creature-tokens`);for(let t of e.matchAll(/artifact creatures you control get ([+\-]\d+)\/([+\-]\d+)/g))r(t,`all-artifacts`);for(let t of e.matchAll(/equipped creature gets ([+\-]\d+)\/([+\-]\d+)/g))r(t,`attached`);for(let t of e.matchAll(/enchanted creature gets ([+\-]\d+)\/([+\-]\d+)/g))r(t,`attached`);let i=e.match(/(?:creatures you control|equipped creature|enchanted creature) (?:have|has|gain|gains) ([a-z, ]+)/);i&&n.push({id:`${t.id||t.cardId||t.name}-keywords`,kind:`static`,action:`grant-keywords`,target:e.includes(`equipped creature`)||e.includes(`enchanted creature`)?`attached`:`all-creatures`,keywords:he(i[1]),sourceName:t.name});let a=e.match(/(?:equipped creature|enchanted creature).*(?:has|gains?) ([a-z, ]+)/);return a&&n.push({id:`${t.id||t.cardId||t.name}-attachment-keywords`,kind:`static`,action:`grant-keywords`,target:`attached`,keywords:he(a[1]),sourceName:t.name}),(/one or more counters would be (?:put|placed)/.test(e)||/would put one or more counters/.test(e))&&/twice that many/.test(e)&&n.push({kind:`replacement`,action:`double-counters`,target:`all-permanents`,sourceName:t.name}),/create.+twice that many|twice that many.+tokens|double the number of tokens/.test(e)&&n.push({kind:`replacement`,action:`double-tokens`,target:`all-tokens`,sourceName:t.name}),/landfall ability of a permanent you control triggers an additional time|landfall abilities trigger an additional time/.test(e)&&n.push({kind:`replacement`,action:`double-landfall-triggers`,target:`all-landfall-triggers`,sourceName:t.name}),n}function k(e,t={}){let n=[],r=t.name||`Card`,i=(e,i)=>{le(i,r).forEach(i=>{n.push({...i,kind:`trigger`,event:e,sourceName:r,sourceId:t.id})})};for(let t of P(e))/whenever .+ creature.+ enters|whenever a creature enters|whenever another creature enters/.test(t)?i(`creature-entered`,t):/whenever a land you control enters|whenever a land enters the battlefield under your control|landfall/.test(t)?i(`land-entered`,t):/this creature enters with|enters with (?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+) [+\-]?\d*\/?[+\-]?\d* counters? on it/.test(t)||/when .+ enters|when this enters/.test(t)?i(`self-entered`,t):/at the beginning of your upkeep/.test(t)?i(`phase:Beginning`,t):/at the beginning of combat/.test(t)?i(`phase:Combat`,t):/at the beginning of your end step|at the beginning of each end step/.test(t)?i(`phase:Ending`,t):/whenever .+ attacks|whenever .+ attack|whenever one or more creatures attack/.test(t)?i(`attack`,t):/whenever .+ dies|whenever a creature dies/.test(t)&&i(`dies`,t);return n}function A(e,t={}){return!t.isInstant&&!t.isSorcery?[]:le(e,t.name).map(e=>({...e,kind:`spell`,sourceName:t.name,sourceId:t.id}))}function le(e,t=``){let n=[],r=D(e),i=oe(r,t);if(r.includes(`create`)&&r.includes(`token`)){let e=j(r);n.push({action:`create-token`,count:me(r),token:ue(r),tapped:r.includes(`tapped`),attacking:r.includes(`attacking`),countFrom:de(r),copySelfAtLandCount:e,copySelf:r.includes(`copy of this creature`),manual:!1})}r.includes(`counter`)&&/\bput\b|\bputs\b|\badd\b|\badds\b/.test(r)&&n.push({action:`add-counters`,count:M(r),counterType:fe(r),target:i.target,entity:i.entity,manual:i.manual});let a=r.match(/enters with (a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+) ((?:\+1\/\+1|-1\/-1|[a-z ]+)) counters? on (?:it|this creature)/);a&&n.push({action:`add-counters`,count:N(a[1]),counterType:pe(a[2]),target:`self`,entity:`permanent`,manual:!1});let o=r.match(/double the number of ((?:\+1\/\+1|-1\/-1|[a-z ]+)) counters on (it|this creature|target creature|target permanent|[a-z0-9 ',\-]+)/);if(o){let e=D(o[2]).includes(D(t));n.push({action:`double-counters`,counterType:pe(o[1]),target:o[2].includes(`target`)?`selected`:e?`self`:`all-creatures`,entity:o[2].includes(`creature`)||e?`creature`:`permanent`,manual:o[2].includes(`target`)})}let s=r.match(/get(?:s)? ([+\-]\d+)\/([+\-]\d+) until end of (turn|combat)/);s&&n.push({action:`temporary-buff`,power:Number(s[1])||0,toughness:Number(s[2])||0,duration:s[3]===`combat`?`combat`:`turn`,target:i.target,entity:i.entity,manual:i.manual});let c=r.match(/you gain (a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+) life/);c&&n.push({action:`life`,amount:N(c[1]),manual:!1});let l=r.match(/(?:deals?|deal) (a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+) damage to (each opponent|target opponent|opponent|any target|target creature|target player)/);return l&&n.push({action:`damage`,amount:N(l[1]),target:ge(l[2]),manual:/target/.test(l[2])}),ye(r)&&!n.some(e=>e.manual)&&n.push({action:`manual-choice`,manual:!0,reason:be(r),summary:xe(r)}),!n.length&&r&&n.push({action:`manual-choice`,manual:!0,reason:`Unsupported effect requires manual resolution`,summary:xe(r)}),n}function ue(e){let t=e.match(/(\d+)\/(\d+)/),n=e.match(/(?:white|blue|black|red|green|colorless|artifact|enchantment|\s)*([a-z]+) creature token/);return{name:n?`${_e(n[1])} Token`:`Token`,typeLine:`Token Creature`,power:t&&Number(t[1])||1,toughness:t&&Number(t[2])||1}}function de(e){return/for each attacking creature|equal to the number of attacking creatures/.test(e)?`attacking-creatures`:/equal to the number of \+1\/\+1 counters on|that many \+1\/\+1 counters on/.test(e)?`source-plus1-counters`:/where x is .* power|equal to .* power/.test(e)?`source-power`:/equal to the number of counters on/.test(e)?`source-all-counters`:/for each land/.test(e)?`lands`:``}function j(e){let t=e.match(/if you control (six|seven|eight|nine|ten|\d+) or more lands/);return t?N(t[1]):0}function fe(e){if(e.includes(`+1/+1 counter`))return`+1/+1`;if(e.includes(`-1/-1 counter`))return`-1/-1`;let t=e.match(/([a-z]+(?: [a-z]+){0,2}) counters?/);return t?ve(t[1].replace(/^(?:a|an|one|two|\d+) /,``)):`Generic`}function pe(e){let t=String(e||``).trim().toLowerCase();return t===`+1/+1`||t===`-1/-1`?t:ve(t.replace(/ counters?$/,``))}function M(e){let t=e.match(/(?:put|puts|add|adds) (a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+)/);return t?N(t[1]):1}function me(e){let t=e.match(/(?:create|creates|created|draw|gain) (a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+)/);return t?N(t[1]):1}function N(e){let t=String(e||``).toLowerCase();return O[t]||Number(t)||1}function P(e){return e.split(/\.\s*/).map(e=>e.trim()).filter(Boolean)}function he(e){return[`flying`,`first strike`,`double strike`,`deathtouch`,`haste`,`hexproof`,`indestructible`,`lifelink`,`menace`,`reach`,`trample`,`vigilance`,`ward`].filter(t=>e.includes(t))}function ge(e){let t=String(e||``).toLowerCase();return t.includes(`each opponent`)?`each-opponent`:t.includes(`opponent`)?`opponent`:t.includes(`target creature`)?`selected-creature`:t.includes(`target player`)?`selected-player`:`selected`}function _e(e){return`${e.charAt(0).toUpperCase()}${e.slice(1)}`}function ve(e){return String(e||``).split(/\s+/).filter(Boolean).map(_e).join(` `)}function ye(e){return e?[/\bmay\b/,/\bchoose\b/,/\btarget\b/,/\bone or more\b/,/\bup to\b/,/\bany number\b/,/\bpay\b/,/\beither\b/,/\battach\b/,/\bequip\b/,/\bdistribute\b/,/\border\b/,/\bunless\b/].some(t=>t.test(e)):!1}function be(e){return/\btarget\b/.test(e)?`Target selection required`:/\bmay\b/.test(e)?`Optional effect decision required`:/\bchoose\b|\beither\b|\bup to\b|\bany number\b/.test(e)?`Mode/choice selection required`:/\battach\b|\bequip\b/.test(e)?`Attachment target choice required`:/\bpay\b|\bunless\b/.test(e)?`Cost/payment decision required`:/\border\b|\bdistribute\b/.test(e)?`Ordering/distribution decision required`:`Manual choice required`}function xe(e){let t=String(e||``).replace(/\s+/g,` `).trim();return t?`Manual choice required: ${t.slice(0,180)}`:`Manual choice required.`}function Se(e={}){return{modifierId:e.modifierId||`${e.sourceId||`source`}:${e.layer||8}:${e.timestamp||Date.now()}`,sourceId:e.sourceId||``,targetSelector:e.targetSelector||`self`,timestamp:Number(e.timestamp)||Date.now(),duration:e.duration||`battlefield`,layer:Number(e.layer)||8,dependencies:Array.isArray(e.dependencies)?e.dependencies:[],operation:e.operation||`none`,amount:e.amount||0,power:Number(e.power)||0,toughness:Number(e.toughness)||0,keywords:Array.isArray(e.keywords)?e.keywords:[],color:e.color||``,setType:e.setType||``,setPower:Number.isFinite(Number(e.setPower))?Number(e.setPower):null,setToughness:Number.isFinite(Number(e.setToughness))?Number(e.setToughness):null,expiresOn:e.expiresOn||``,sourceName:e.sourceName||``}}function Ce(e){let t=[];return[...e.battlefield.player,...e.battlefield.opponent].forEach(e=>{(e.temporaryModifiers||[]).forEach((n,r)=>{t.push(Se({modifierId:`${e.id}:temp:${r}`,sourceId:e.id,sourceName:e.name,targetSelector:`self`,layer:8,operation:`add-pt`,power:Number(n.power)||0,toughness:Number(n.toughness)||0,duration:n.duration||`turn`}))}),Object.entries(e.counters||{}).forEach(([r,i])=>{if(Number(i)&&(r===`+1/+1`||r===`-1/-1`)){let a=r===`+1/+1`?1:-1;t.push(Se({modifierId:`${e.id}:counter:${r}`,sourceId:e.id,sourceName:e.name,targetSelector:`self`,layer:9,operation:`add-pt`,power:a*n(i),toughness:a*n(i),duration:`battlefield`}))}}),(e.parsedEffects||[]).forEach((n,r)=>{n.kind===`static`&&(n.action===`modify-power-toughness`&&t.push(Se({modifierId:`${e.id}:static:${r}`,sourceId:e.id,sourceName:e.name,targetSelector:n.target||`all-creatures`,layer:8,operation:`add-pt`,power:Number(n.power)||0,toughness:Number(n.toughness)||0,duration:`battlefield`})),n.action===`grant-keywords`&&t.push(Se({modifierId:`${e.id}:keywords:${r}`,sourceId:e.id,sourceName:e.name,targetSelector:n.target||`self`,layer:6,operation:`add-keywords`,keywords:n.keywords||[],duration:`battlefield`})))}),(e.continuousEffects||[]).forEach((n,r)=>{let i=Number(n.layer)||8;t.push(Se({modifierId:`${e.id}:continuous:${r}`,sourceId:e.id,sourceName:e.name,targetSelector:n.targetSelector||`self`,layer:i,operation:n.operation||`none`,dependencies:n.dependencies||[],duration:n.duration||`battlefield`,power:n.power,toughness:n.toughness,keywords:n.keywords,setType:n.setType,setPower:n.setPower,setToughness:n.setToughness,color:n.color}))})}),t.sort((e,t)=>e.layer-t.layer||e.timestamp-t.timestamp)}function we(e){let t=Ce(e),n=n=>n.map(n=>Te(e,n,t));return{...e,layerContext:{modifiers:t,updatedAt:Date.now()},battlefield:{...e.battlefield,player:n(e.battlefield.player),opponent:n(e.battlefield.opponent)}}}function Te(e,t,n){let r=b({...t,currentPower:t.basePower,currentToughness:t.baseToughness,keywords:[...new Set(t.keywords||[])]}),i=[];return n.forEach(n=>{if(!Ee(e,n,t))return;let a=r.currentPower,o=r.currentToughness,s=new Set(r.keywords||[]);n.layer===4&&n.operation===`set-type`&&n.setType&&(r.typeLine=n.setType),n.layer===5&&n.operation===`set-color`&&n.color&&(r.colors=[n.color]),n.layer===6&&n.operation===`add-keywords`&&n.keywords?.length&&(r.keywords=[...new Set([...r.keywords||[],...n.keywords])]),n.layer===7&&n.operation===`set-base-pt`&&(Number.isFinite(n.setPower)&&(r.currentPower=n.setPower),Number.isFinite(n.setToughness)&&(r.currentToughness=n.setToughness)),(n.layer===8||n.layer===9)&&n.operation===`add-pt`&&(r.currentPower+=Number(n.power)||0,r.currentToughness+=Number(n.toughness)||0);let c=[...r.keywords||[]].filter(e=>!s.has(e));(a!==r.currentPower||o!==r.currentToughness||c.length||n.layer<=6)&&i.push({layer:n.layer,modifierId:n.modifierId,sourceId:n.sourceId,sourceName:n.sourceName,operation:n.operation,powerDelta:r.currentPower-a,toughnessDelta:r.currentToughness-o,keywordDelta:c})}),b({...r,layerBreakdown:i,currentPower:Number.isFinite(r.currentPower)?r.currentPower:t.basePower,currentToughness:Number.isFinite(r.currentToughness)?r.currentToughness:t.baseToughness})}function Ee(e,t,n){if(t.targetSelector===`self`)return t.sourceId===n.id;let r=De(e,t.sourceId);return r?T(e,t.targetSelector,r).some(e=>e.id===n.id):!1}function De(e,t){return[...e.battlefield.player,...e.battlefield.opponent].find(e=>e.id===t)||null}var F={"anim pakal thousandth moon":{parsedEffects:[{kind:`trigger`,event:`attack`,condition:`attack-non-gnome-you-control`,action:`add-counters`,count:1,counterType:`+1/+1`,target:`self`,entity:`creature`,manual:!1},{kind:`trigger`,event:`attack`,condition:`attack-non-gnome-you-control`,action:`create-token`,count:1,countFrom:`source-plus1-counters`,token:{name:`Gnome Token`,typeLine:`Token Artifact Creature - Gnome`,power:1,toughness:1},tapped:!0,attacking:!0,manual:!1}]},"cathars crusade":{parsedEffects:[{kind:`trigger`,event:`creature-entered`,condition:`creature-entered-controlled`,action:`add-counters`,count:1,counterType:`+1/+1`,target:`your-creatures`,entity:`creature`,manual:!1}]},"mossborn hydra":{parsedEffects:[{kind:`trigger`,event:`self-entered`,condition:`self-entered`,action:`add-counters`,count:1,counterType:`+1/+1`,target:`self`,entity:`creature`,manual:!1},{kind:`trigger`,event:`land-entered`,condition:`land-entered-controlled`,action:`double-counters`,counterType:`+1/+1`,target:`self`,entity:`creature`,manual:!1}]},"soul warden":{parsedEffects:[{kind:`trigger`,event:`creature-entered`,condition:`creature-entered-other`,action:`life`,amount:1,manual:!1}]},"warleader s call":{parsedEffects:[{id:`warleaders-call-static`,kind:`static`,action:`modify-power-toughness`,target:`your-creatures`,power:1,toughness:1,sourceName:`Warleader's Call`},{kind:`trigger`,event:`creature-entered`,condition:`creature-entered-controlled`,action:`damage`,amount:1,target:`each-opponent`,manual:!1}]},"doubling season":{parsedEffects:[{kind:`replacement`,action:`double-tokens`,target:`all-tokens`,sourceName:`Doubling Season`},{kind:`replacement`,action:`double-counters`,target:`all-permanents`,sourceName:`Doubling Season`}]},"scute swarm":{parsedEffects:[{kind:`trigger`,event:`land-entered`,condition:`land-entered-controlled`,action:`create-token`,count:1,token:{name:`Insect Token`,typeLine:`Token Creature - Insect`,power:1,toughness:1},copySelfAtLandCount:6,copySelf:!0,manual:!1}]},"traveling chocobo":{parsedEffects:[{kind:`replacement`,action:`double-landfall-triggers`,target:`all-landfall-triggers`,sourceName:`Traveling Chocobo`}]}};function Oe(e={},t=[]){let n=F[ke(e.name)];return n?(n.parsedEffects||[]).map(t=>({sourceName:e.name||t.sourceName||`Card`,...t})):t}function ke(e=``){return D(e).replace(/[^a-z0-9 ]+/g,` `).replace(/\s+/g,` `).trim()}var Ae={W:`White`,U:`Blue`,B:`Black`,R:`Red`,G:`Green`,C:`Colorless`};function je(e={}){let n=Ie(e.typeLine||`Permanent`),i=t(e.manaCost),a=Oe(e,se(e)),o=Array.from(new Set([...e.keywords||[],...a.filter(e=>e.action===`grant-keywords`).flatMap(e=>e.keywords||[])])),s=a.filter(e=>e.kind===`static`),c=Array.isArray(e.activatedAbilities)?e.activatedAbilities:[],l=I(a.filter(e=>e.kind===`trigger`),e.id||e.cardId||``),u=a.filter(e=>e.kind===`replacement`),d=Me(e.continuousEffects||[],e.id||e.cardId||``),f=Ne(a,e.tokenDefinitions||[]);return{id:t(e.id||e.cardId),name:t(e.name,`Card`),manaCost:i,manaValue:Fe(i),typeLine:t(e.typeLine,`Permanent`),subtypes:n.subtypes,colors:Pe(e.colors,i),supertypes:n.supertypes,power:r(e.power??e.basePower),toughness:r(e.toughness??e.baseToughness),loyalty:Number.isFinite(Number(e.loyalty))?Number(e.loyalty):0,keywords:o,staticAbilities:s,activatedAbilities:c,triggeredAbilities:l,replacementEffects:u,continuousEffects:d,tokenDefinitions:f,parsedEffects:a,metadata:{source:e.metadata?.source||`runtime`,setCode:e.metadata?.setCode||e.setCode||``,rarity:e.metadata?.rarity||e.rarity||``,imageUrl:e.imageUrl||e.metadata?.imageUrl||``},rulesText:t(e.rulesText||e.oracleText),flavorText:t(e.flavorText),relationships:Le(e.relationships),tags:Re(e.tags,n,e)}}function I(e,t){let n=(e={})=>{let t=String(e.event||``);return t.startsWith(`phase:`)?e.condition||t.split(`:`)[1]||``:t===`self-entered`||t===`creature-entered`||t===`land-entered`||t===`attack`||t===`dies`?e.condition||t:e.condition||``};return e.map((e,r)=>({id:e.id||`${t||`source`}:trigger:${r}`,sourceId:t,eventType:ze(e.event),timing:e.event?.startsWith(`phase:`)?`phase`:`event`,condition:n(e),targetSelector:e.target||`all-creatures`,optional:!!e.optional,oncePerTurn:!!e.oncePerTurn,effectDefinitions:e.effectDefinitions||[e],priority:Number.isFinite(Number(e.priority))?Number(e.priority):0,stackBehavior:e.stackBehavior||`stack`}))}function Me(e,t){return e.filter(Boolean).map((e,n)=>({modifierId:e.modifierId||`${t||`source`}:continuous:${n}`,sourceId:t,targetSelector:e.targetSelector||e.target||`self`,timestamp:Date.now()+n,duration:e.duration||`battlefield`,layer:Number(e.layer)||Be(e),dependencies:e.dependencies||[],operation:e.operation||Ve(e),power:e.power,toughness:e.toughness,keywords:e.keywords||[],color:e.color||``,setType:e.setType||``,setPower:e.setPower,setToughness:e.setToughness,expirationRules:e.expirationRules||``}))}function Ne(e,t){let n=e.filter(e=>e.action===`create-token`).map((e,t)=>({id:`token:${t}`,name:e.token?.name||`Token`,typeLine:e.token?.typeLine||`Token Creature`,power:Number(e.token?.power)||0,toughness:Number(e.token?.toughness)||0,tapped:!!e.tapped,attacking:!!e.attacking}));return[...t,...n]}function Pe(e,t){if(Array.isArray(e)&&e.length)return[...new Set(e)];let n=[...String(t||``).matchAll(/\{([WUBRGC])\}/g)].map(e=>Ae[e[1]]).filter(Boolean);return[...new Set(n)]}function Fe(e){let t=0;for(let n of String(e||``).matchAll(/\{([^}]+)\}/g)){let e=n[1];if(/^\d+$/.test(e)){t+=Number(e);continue}/^[WUBRGCXYZ]$/.test(e)&&(t+=1)}return t}function Ie(e){let[t=``,n=``]=String(e||`Permanent`).split(`—`).map(e=>e.trim()),r=t.split(/\s+/).filter(Boolean),i=r.filter(e=>[`Legendary`,`Basic`,`Snow`,`World`,`Ongoing`].includes(e));return{supertypes:i,coreTypes:r.filter(e=>!i.includes(e)),subtypes:n?n.split(/\s+/).filter(Boolean):[]}}function Le(e={}){return{attachedToId:e.attachedToId||``,attachedIds:Array.isArray(e.attachedIds)?e.attachedIds:[],copiedFromId:e.copiedFromId||``,linkedCommanderKey:e.linkedCommanderKey||``}}function Re(e=[],t={},n={}){let r=new Set(Array.isArray(e)?e:[]);return t.supertypes.forEach(e=>r.add(e.toLowerCase())),t.subtypes.forEach(e=>r.add(e.toLowerCase())),n.isToken&&r.add(`token`),n.isCommander&&r.add(`commander`),[...r]}function ze(e){return e?e===`creature-entered`||e===`self-entered`?`ENTER_BATTLEFIELD`:e===`attack`?`ATTACK_TRIGGER_CHECK`:e===`land-entered`?`LANDFALL_CHECK`:e===`dies`?`LEAVE_BATTLEFIELD`:String(e).startsWith(`phase:`)?`PHASE_CHANGED`:String(e).toUpperCase():`UNKNOWN`}function Be(e){return e.action===`grant-keywords`?6:(e.action,8)}function Ve(e){return e.action===`grant-keywords`?`add-keywords`:e.action===`modify-power-toughness`?`add-pt`:`none`}function L(e){let t=je(e);return b({...e,...t,manaValue:t.manaValue,rulesText:t.rulesText,flavorText:t.flavorText,staticAbilities:t.staticAbilities,activatedAbilities:t.activatedAbilities,triggeredAbilities:t.triggeredAbilities,replacementEffects:t.replacementEffects,continuousEffects:t.continuousEffects,tokenDefinitions:t.tokenDefinitions,metadata:t.metadata,relationships:t.relationships,tags:t.tags,parsedEffects:t.parsedEffects||se(e)})}function R(e){return we({...e,battlefield:{...e.battlefield,player:e.battlefield.player.map(tt),opponent:e.battlefield.opponent.map(tt)}})}function z(t,n){let r=t,i=gt(n),a=i.chainId||e(`chain`);r=H(r,`event-emitted`,{eventType:i.eventType||``,chainId:a,sourceId:i.payload?.permanent?.id||``,instances:i.payload?.instances||i.instances||1});let o=B(r),s=!1;return o.forEach(e=>{(e.triggeredAbilities||[]).filter(t=>nt(t,i,e,r)).forEach(t=>{r=H(r,`trigger-detected`,{source:e.name,sourceId:e.id,eventType:i.eventType||``,condition:t.condition||``});let n=(t.effectDefinitions||[]).map(n=>({...n,manual:!!(n.manual||t.optional),sourceId:e.id,sourceName:e.name})),o=ct(r,t,i,e);for(let c=0;c<o;c+=1)r=rt(r,{source:e,event:i,chainId:a,optional:!!t.optional,oncePerTurn:!!t.oncePerTurn,targetSelector:t.targetSelector||`all-creatures`,effectDefinitions:n,triggerCondition:t.condition||``}),s=!0,r=H(r,`trigger-queued`,{source:e.name,triggerId:r.triggerQueue[0]?.id||``,eventType:i.eventType||``,repeat:c+1,repeats:o}),n.every(e=>it(e,r))&&(r=He(r,{triggerId:r.triggerQueue[0]?.id,command:`resolve`,requestedBy:`auto`}),s=!0)})}),s||xt(n)?R(r):r}function He(e,{triggerId:t,command:n=`resolve`,requestedBy:r=`player`}={}){let i=[...e.triggerQueue||[]],a=i.findIndex(e=>e.id===t);if(a<0)return e;let o=i[a];if(n===`skip`)return i[a]={...o,status:`skipped`,resolvedAt:Date.now(),resolution:{command:n,requestedBy:r}},{...e,triggerQueue:i};if(n===`delay`)return i[a]={...o,status:`delayed`,delayedUntilTurn:e.turn+1,delayedUntilPhase:(e.phaseIndex+1)%5,resolution:{command:n,requestedBy:r}},{...e,triggerQueue:i};let s=B(e).find(e=>e.id===o.sourceId)||b({id:o.sourceId,name:o.sourceName}),c={...e,triggerQueue:i};(o.effectDefinitions||[]).forEach(e=>{let t=B(c).find(e=>e.id===o.sourceId)||s;c=We(c,e,t,{type:o.eventType?.toLowerCase()||`trigger`,eventType:o.eventType,payload:{...o.eventPayload||{},triggerId:o.id},triggerId:o.id,chainId:o.chainId})});let l=at(c,s.id),u=[...c.triggerQueue||[]],d=u.findIndex(e=>e.id===o.id);d>=0&&(u[d]={...u[d],status:`resolved`,resolvedAt:Date.now(),generatedModifiers:l,resolution:{command:n,requestedBy:r}});let f=R({...c,triggerQueue:u}),p=f.battlefield.player.reduce((e,t)=>e+(t.quantity||1),0)+f.battlefield.opponent.reduce((e,t)=>e+(t.quantity||1),0);return H(f,`trigger-resolved`,{triggerId:o.id,source:s.name,queueStatus:`resolved`,battlefieldCount:p,life:f.life,opponentDamage:f.commander?.damageByOpponent?.opponent||0})}function Ue(e,t){let n=L({...t,isInstant:t.isInstant,isSorcery:t.isSorcery}),r=e,i=0;return n.parsedEffects.filter(e=>e.kind===`spell`).forEach(e=>{let t=JSON.stringify(r);r=We(r,e,n,{type:`spell-cast`,source:n}),JSON.stringify(r)!==t&&(i+=1)}),{...R(r),effectLog:[V(n.name,i>0?`Spell resolved with supported automated effects.`:`Spell logged for manual resolution.`),...r.effectLog].slice(0,60)}}function We(t,n,r,i={}){if(n.manual){let a={id:e(`pending`),sourceId:r.id,sourceName:r.name,effect:n,summary:n.summary||n.reason||`Manual choice required`,status:`pending`,createdAt:Date.now(),triggerId:i.payload?.triggerId||i.triggerId||``,eventType:i.eventType||i.type||``};return{...t,pendingEffects:[a,...t.pendingEffects].slice(0,60),effectLog:[V(r.name,`Manual choice required: ${n.summary||n.reason||n.action||`effect`}.`),...t.effectLog].slice(0,80)}}switch(n.action){case`create-token`:return Ge(t,n,r,i);case`add-counters`:return Ke(t,n,r,i);case`double-counters`:return qe(t,n,r,i);case`temporary-buff`:return et(t,n,r);case`life`:return Je(t,n,r,i);case`damage`:return Ye(t,n,r,i);default:return t}}function Ge(e,t,r,i){let a=t.controller||r.controller||`player`,o=Math.max(1,n(i.payload?.instances??i.instances,1)),s=lt(e,a,`double-tokens`).length,c=ot(e,a),l=n(Xe(e,t,r),0),u=Math.max(0,l*c*o);if(u<=0)return H(e,`tokens-created`,{source:r.name,token:t.token?.name||`Token`,count:0,controller:a,multiplier:c,replacementCount:s,repeats:o,skipped:`zero-count`});let d=!!t.copySelf&&(!t.copySelfAtLandCount||Ze(e,a)>=Number(t.copySelfAtLandCount||0)),f=L({...d?Qe(r,a,t):{name:t.token?.name||`Token`,typeLine:t.token?.typeLine||`Token Creature`,basePower:t.token?.power,baseToughness:t.token?.toughness,oracleText:t.token?.oracleText||``},quantity:u,isToken:!0,isCopy:d,controller:a,owner:a,tapped:t.tapped||t.attacking,attacking:t.attacking,blocking:!!t.blocking,summoningSick:!!(t.summoningSick??!t.attacking),enteredDuringCombat:!!(t.attacking||r.attacking||String(i.payload?.phase||``).toLowerCase().includes(`combat`)),attackingPlayerId:t.attackingPlayerId||i.payload?.attackingPlayerId||`opponent`,attackedObjectId:t.attackedObjectId||i.payload?.attackedObjectId||`opponent`,createdByTriggerId:i.payload?.triggerId||i.triggerId||``,sourcePermanentId:r.id,combatPhaseCreatedIn:t.combatPhaseCreatedIn||i.payload?.phase||``,tokenTemplateId:t.tokenTemplateId||t.token?.id||t.token?.name||``,tokenCopyOfId:d?r.id:``,ownedByCommanderDeck:!1}),p=a===`player`?`player`:`opponent`;return $e(H({...e,battlefield:{...e.battlefield,[p]:ut(e.battlefield[p],f)},combat:t.attacking?{...e.combat,attackerIds:[...new Set([...e.combat.attackerIds||[],f.id])]}:e.combat,effectLog:[V(r.name,`Created ${u} ${f.name}${t.attacking?` tapped and attacking`:``}.`),...e.effectLog].slice(0,60)},`tokens-created`,{source:r.name,token:f.name,count:u,controller:a,multiplier:c,replacementCount:s,repeats:o,copy:d,tapped:!!f.tapped,attacking:!!f.attacking,enteredDuringCombat:!!f.enteredDuringCombat}),f,{instances:u,cause:i.type||i.eventType||`effect`,chainId:i.chainId})}function Ke(e,t,r,i){let a=Math.max(1,n(t.count,1)),o=Math.max(1,n(i.payload?.instances??i.instances,1)),s=T(e,t.target,r,i),c=new Set(s.map(e=>e.id)),l=i=>{if(!c.has(i.id))return i;let s=st(e,i.controller||r.controller),l=n(i.counters?.[t.counterType]);return b({...i,counters:{...i.counters,[t.counterType]:l+a*o*s}})};return H({...e,battlefield:{...e.battlefield,player:e.battlefield.player.map(l),opponent:e.battlefield.opponent.map(l)},effectLog:[V(r.name,`Added counters to ${s.length} target(s).`),...e.effectLog].slice(0,60)},`counters-added`,{source:r.name,counterType:t.counterType,baseCount:a,repeats:o,targets:s.length,replacementCount:lt(e,r.controller||`player`,`double-counters`).length})}function qe(e,t,r,i={}){let a=T(e,t.target||`self`,r,i),o=new Set(a.map(e=>e.id)),s=t.counterType||`+1/+1`,c=Math.max(1,n(i.payload?.instances??i.instances,1)),l=t=>{if(!o.has(t.id))return t;let i=n(t.counters?.[s],0);if(!i)return t;let a=st(e,t.controller||r.controller),l=i*c*a;return b({...t,counters:{...t.counters||{},[s]:i+l}})};return H({...e,battlefield:{...e.battlefield,player:e.battlefield.player.map(l),opponent:e.battlefield.opponent.map(l)},effectLog:[V(r.name,`Doubled ${s} counters on ${a.length} permanent(s).`),...e.effectLog].slice(0,60)},`counters-doubled`,{source:r.name,counterType:s,targets:a.length,repeats:c})}function Je(e,t,r,i={}){let a=Math.max(1,n(i.payload?.instances??i.instances,1)),o=(Number(t.amount)||0)*a;return H({...e,life:Math.max(0,e.life+o),effectLog:[V(r.name,`Life changed by ${o}.`),...e.effectLog].slice(0,60)},`life-applied`,{source:r.name,amount:o,repeats:a})}function Ye(e,t,r,i={}){let a=Math.max(1,n(i.payload?.instances??i.instances,1)),o=Math.max(0,Number(t.amount)||0)*a,s=n(e.commander?.damageByOpponent?.opponent,0);return H({...e,commander:{...e.commander,damageByOpponent:{...e.commander?.damageByOpponent||{},opponent:s+o}},effectLog:[V(r.name,`Dealt ${o} damage to opponent.`),...e.effectLog].slice(0,60)},`damage-applied`,{source:r.name,amount:o,target:t.target,repeats:a})}function Xe(e,t,r){let i=String(t.countFrom||``).toLowerCase();if(i===`attacking-creatures`)return B(e).filter(t=>t.controller===r.controller&&t.isCreature&&(e.combat?.attackerIds||[]).includes(t.id)).length;if(i===`source-power`){let t=B(e).find(e=>e.id===r.id)||r,n=Number(t.currentPower??t.basePower??0);return Number.isFinite(n)?Math.max(0,Math.trunc(n)):0}if(i===`source-plus1-counters`)return n((B(e).find(e=>e.id===r.id)||r).counters?.[`+1/+1`],0);if(i===`source-all-counters`){let t=B(e).find(e=>e.id===r.id)||r;return Object.values(t.counters||{}).reduce((e,t)=>e+n(t,0),0)}return i===`lands`?Ze(e,r.controller):n(t.count,0)}function Ze(e,t=`player`){return B(e).filter(e=>e.controller===t&&e.isLand).reduce((e,t)=>e+(t.quantity||1),0)}function Qe(e,t,n){return{cardId:e.cardId,name:e.name,manaCost:e.manaCost,typeLine:e.typeLine,oracleText:e.oracleText,rulesText:e.rulesText,basePower:e.basePower,baseToughness:e.baseToughness,colors:e.colors,colorIdentity:e.colorIdentity,legalities:e.legalities,subtypes:e.subtypes,supertypes:e.supertypes,keywords:e.keywords,metadata:{...e.metadata||{},copiedFromId:e.id,copiedVia:n.sourceName||e.name},controller:t,owner:t}}function $e(e,t,{instances:n=1,cause:r=`effect`,chainId:i=``}={}){let a={permanent:t,instances:n,cause:r,controller:t.controller},o=z(e,{type:`permanent-entered`,eventType:`ENTER_BATTLEFIELD`,permanent:t,payload:a,instances:n,cause:r,chainId:i});return t.isLand&&(o=z(o,{type:`land-entered-battlefield`,eventType:`LAND_ENTERED_BATTLEFIELD`,permanent:t,payload:a,instances:n,cause:r,chainId:i}),o=z(o,{type:`landfall-check`,eventType:`LANDFALL_CHECK`,permanent:t,payload:a,instances:n,cause:r,chainId:i})),o}function et(e,t,n){let r=T(e,t.target,n),i=new Set(r.map(e=>e.id)),a=e=>i.has(e.id)?b({...e,temporaryModifiers:[...e.temporaryModifiers||[],{power:t.power,toughness:t.toughness,duration:t.duration,sourceName:n.name}]}):e;return{...e,battlefield:{...e.battlefield,player:e.battlefield.player.map(a),opponent:e.battlefield.opponent.map(a)},effectLog:[V(n.name,`Applied ${t.power}/${t.toughness} temporary modifier.`),...e.effectLog].slice(0,60)}}function tt(e){return b({...e,keywords:[...new Set(e.keywords||[])],currentPower:e.basePower,currentToughness:e.baseToughness})}function nt(e,t,n,r){let i=String(e.eventType||``).toUpperCase();if(!i)return!1;let a=String(t.eventType||``).toUpperCase(),o=[`DESTROY`,`EXILE`,`SACRIFICE`].includes(a)?`LEAVE_BATTLEFIELD`:a;return!o||o!==i?!1:i===`ENTER_BATTLEFIELD`?_t(e.condition,t,n):i===`LAND_ENTERED_BATTLEFIELD`||i===`LANDFALL_CHECK`?vt(e.condition,t,n):i===`ATTACK_DECLARED`||i===`ATTACK_TRIGGER_CHECK`?yt(e.condition,t,n,r):[`LEAVE_BATTLEFIELD`,`DESTROY`,`EXILE`,`SACRIFICE`].includes(i)?bt(e.condition,t):i===`PHASE_CHANGED`&&e.timing===`phase`?!e.condition||e.condition===t.payload?.phase||e.condition===t.phase:!0}function rt(t,{source:n,event:r,chainId:i,optional:a,oncePerTurn:o,targetSelector:s,effectDefinitions:c,triggerCondition:l=``}){let u={id:e(`trigger`),chainId:i,sourceId:n.id,sourceName:n.name,eventType:r.eventType||String(r.type||``).toUpperCase()||`TRIGGER`,eventPayload:r.payload||{},targetSelector:s||`all-creatures`,optional:!!a,oncePerTurn:!!o,triggerCondition:l,effectDefinitions:c||[],status:`pending`,createdAt:Date.now(),generatedModifiers:[]};return{...t,triggerQueue:[u,...t.triggerQueue||[]].slice(0,120)}}function it(e,t){let n=t.runtime||{},r=new Set([`create-token`,`add-counters`,`double-counters`,`life`,`damage`]),i=n.adhdAutomation!==!1||r.has(e.action),a=n.confirmAmbiguousEffects!==!1;return!(!i||e.manual||e.optional||a&&e.target===`selected`)}function at(e,t){return(e.layerContext?.modifiers||[]).filter(e=>e.sourceId===t).slice(0,8).map(e=>({modifierId:e.modifierId,layer:e.layer,operation:e.operation,targetSelector:e.targetSelector}))}function ot(e,t=`player`){let n=lt(e,t,`double-tokens`);return n.length?2**n.length:1}function st(e,t=`player`){let n=lt(e,t,`double-counters`);return n.length?2**n.length:1}function ct(e,t,n,r){let i=String(n.eventType||``).toUpperCase();return![`LAND_ENTERED_BATTLEFIELD`,`LANDFALL_CHECK`].includes(i)||!String(t.condition||``).includes(`land-entered`)?1:1+lt(e,r.controller||`player`,`double-landfall-triggers`).length}function lt(e,t,n){return B(e).filter(e=>e.controller===t).flatMap(e=>(e.replacementEffects||[]).length?e.replacementEffects||[]:(e.parsedEffects||[]).filter(e=>e.kind===`replacement`)).filter(e=>e.action===n)}function ut(e,t){let n=e.findIndex(e=>dt(e,t));return n<0?[...e,ht(t)]:e.map((e,r)=>r===n?b({...e,quantity:(e.quantity||1)+(t.quantity||1),stackMembers:[...e.stackMembers||[],...ht(t).stackMembers||[]]}):e)}function dt(e,t){return(e.isToken&&t.isToken||e.isCopy&&t.isCopy)&&ft(e)===ft(t)}function ft(e){return JSON.stringify({name:e.name,cardId:e.cardId,typeLine:e.typeLine,oracleText:e.oracleText,controller:e.controller,owner:e.owner,basePower:e.basePower,baseToughness:e.baseToughness,counters:pt(e.counters),keywords:[...e.keywords||[]].sort(),tapped:e.tapped,summoningSick:e.summoningSick,attacking:e.attacking,blocking:e.blocking,enteredDuringCombat:e.enteredDuringCombat,attackingPlayerId:e.attackingPlayerId,attackedObjectId:e.attackedObjectId,createdByTriggerId:e.createdByTriggerId,sourcePermanentId:e.sourcePermanentId,combatPhaseCreatedIn:e.combatPhaseCreatedIn,tokenTemplateId:e.tokenTemplateId,tokenCopyOfId:e.tokenCopyOfId,attachedToId:e.attachedToId,temporaryModifiers:mt(e.temporaryModifiers),isCopy:e.isCopy,isCommander:e.isCommander})}function pt(e={}){return Object.keys(e).sort().reduce((t,n)=>(t[n]=e[n],t),{})}function mt(e=[]){return[...e].map(e=>pt(e)).sort((e,t)=>JSON.stringify(e).localeCompare(JSON.stringify(t)))}function B(e){return[...e.battlefield.player,...e.battlefield.opponent]}function ht(t){let n=Math.max(1,Number(t.quantity)||1),r=Array.isArray(t.stackMembers)&&t.stackMembers.length?t.stackMembers:[],i=r.length>=n?r.slice(0,n):[...r,...Array.from({length:n-r.length},()=>({instanceId:e(`member`),tapped:!!t.tapped,attacking:!!t.attacking,blocking:!!t.blocking,summoningSick:!!t.summoningSick,counters:{...t.counters||{}},attachments:Array.isArray(t.attachments)?[...t.attachments]:[],temporaryModifiers:Array.isArray(t.temporaryModifiers)?[...t.temporaryModifiers]:[],metadata:{enteredDuringCombat:!!t.enteredDuringCombat,attackingPlayerId:t.attackingPlayerId||``,attackedObjectId:t.attackedObjectId||``,createdByTriggerId:t.createdByTriggerId||``,sourcePermanentId:t.sourcePermanentId||``,combatPhaseCreatedIn:t.combatPhaseCreatedIn||``,tokenTemplateId:t.tokenTemplateId||``,tokenCopyOfId:t.tokenCopyOfId||``}}))];return{...t,quantity:n,stackMembers:i}}function V(t,n){return{id:e(`log`),at:Date.now(),sourceName:t,summary:n}}function gt(e={}){if(String(e.eventType||``).toUpperCase())return e;let t={"permanent-entered":`ENTER_BATTLEFIELD`,"land-entered-battlefield":`LAND_ENTERED_BATTLEFIELD`,"landfall-check":`LANDFALL_CHECK`,"attackers-declared":`ATTACK_TRIGGER_CHECK`,"attack-trigger-check":`ATTACK_TRIGGER_CHECK`,"permanent-died":`LEAVE_BATTLEFIELD`,"phase-changed":`PHASE_CHANGED`}[String(e.type||``).toLowerCase()]||``;return{...e,eventType:t||e.eventType||``,payload:e.payload||{}}}function _t(e,t,n){let r=t.payload?.permanent||t.permanent;if(!r)return!1;let i=String(e||``).toLowerCase();return i?i===`self-entered`?r.id===n.id:i===`creature-entered`?!!r.isCreature:i===`creature-entered-other`?!!r.isCreature&&r.id!==n.id:i===`creature-entered-controlled`?!!r.isCreature&&r.controller===n.controller:!0:!0}function vt(e,t,n){let r=t.payload?.permanent||t.permanent;if(!r||!r.isLand)return!1;let i=String(e||``).toLowerCase();return!i||i===`land-entered`?!0:i===`land-entered-controlled`?r.controller===n.controller:!0}function yt(e,t,n,r){let i=t.payload?.attackerIds||t.ids||[],a=B(r).filter(e=>i.includes(e.id)),o=String(e||``).toLowerCase();return!o||o===`attack`?a.length>0:o===`attack-non-gnome-you-control`?a.some(e=>e.controller===n.controller&&e.isCreature&&!/\bGnome\b/i.test(e.typeLine||``)):a.length>0}function bt(e,t){let n=t.payload?.permanent||t.permanent;if(!n)return!1;let r=String(t.payload?.cause||t.cause||``).toLowerCase();return e===`dies`?[`exile`,`bounce`,`return`,`remove`].includes(r)?!1:!!n.isCreature:!0}function xt(e={}){let t=String(e.eventType||e.type||``).toLowerCase();return[`enter_battlefield`,`leave_battlefield`,`destroy`,`exile`,`sacrifice`,`counter_added`,`counter_removed`,`token_created`,`phase_changed`,`turn_changed`,`land_entered_battlefield`,`landfall_check`,`attack_trigger_check`,`permanent-entered`,`permanent-left`,`permanent-died`,`attackers-declared`,`blockers-declared`,`phase-changed`,`turn-changed`,`spell-cast`].includes(t)}function H(t,n,r={}){if(!t.runtime?.debugRules)return t;let i={id:e(`debug`),at:Date.now(),kind:n,payload:r};return typeof console<`u`&&typeof console.debug==`function`&&console.debug(`[RulesDebug]`,n,r),{...t,debugTrace:[i,...t.debugTrace||[]].slice(0,400)}}var St=new Set([`plains`,`island`,`swamp`,`mountain`,`forest`,`wastes`]);function Ct(e){let t=e.typeLine||``,n=e.oracleText||``;return/\bLegendary\b/i.test(t)&&(/\bCreature\b/i.test(t)||/\bArtifact\b/i.test(t))||/\bPlaneswalker\b/i.test(t)&&/can be your commander/i.test(n)}function wt(e,t){let n=S(t.name),r={name:t.name,cardId:t.cardId,colorIdentity:t.colorIdentity||[],zone:`command`,castCount:0,commanderTax:0,damageByOpponent:{},deckKey:n};return{...e,activeSession:{...e.activeSession,commander:r},commanders:{...e.commanders,[n]:e.commanders[n]||x(r)}}}function Tt(e){let t=e.activeSession;if(!t.commander?.name)return e;let r=b({...t.commander,name:t.commander.name,typeLine:`Legendary Creature`,isCommander:!0,controller:`player`,owner:`player`,ownedByCommanderDeck:!0}),i=n(t.commander.castCount)+1;return{...e,activeSession:{...t,commander:{...t.commander,zone:`battlefield`,castCount:i,commanderTax:Math.max(0,(i-1)*2)},battlefield:{...t.battlefield,player:[...t.battlefield.player,r]}}}}function Et(e){if(e.isToken||e.isCopy)return!1;let t=String(e.name||``).toLowerCase();if(St.has(t))return!1;let n=e.typeLine||``;return/\b(Creature|Artifact|Enchantment|Planeswalker|Instant|Sorcery|Land)\b/i.test(n)}function Dt(e,t){let n=new Set(t?.colorIdentity||[]);return(e.colorIdentity||[]).every(e=>n.has(e))}function Ot(e,t,n=`manual`){let r=e.activeSession.commander;if(!r?.deckKey||!Et(t)||!Dt(t,r))return e;let i=e.commanders[r.deckKey]||x(r),a=t.cardId||t.name.toLowerCase();if(i.cards.some(e=>e.key===a))return e;let o={key:a,name:t.name,manaCost:t.manaCost,typeLine:t.typeLine,colorIdentity:t.colorIdentity||[],source:n,addedAt:Date.now()};return{...e,commanders:{...e.commanders,[r.deckKey]:{...i,cards:[...i.cards,o],evolution:[...i.evolution,{type:`added`,cardName:t.name,at:Date.now(),source:n}]}}}}function kt(e,t){let n=e.activeSession.commander;if(!n?.deckKey||t.owner!==`player`||t.controller!==`player`||t.isToken||t.isCopy||t.ownedByCommanderDeck===!1)return e;let r=e.commanders[n.deckKey]||x(n),i=t.cardId||t.name.toLowerCase(),a=r.usage[i]||{name:t.name,count:0,lastUsedAt:Date.now()};return Ot({...e,commanders:{...e.commanders,[n.deckKey]:{...r,usage:{...r.usage,[i]:{...a,count:a.count+1,lastUsedAt:Date.now()}}}}},t,`gameplay`)}function At(t,n){let r=new Set(n);return{...t,battlefield:{...t.battlefield,player:t.battlefield.player.map(e=>{let t=r.has(e.id)&&e.isCreature;return{...e,attacking:t,tapped:t&&!Pt(e,`vigilance`)?!0:e.tapped}})},combat:{...t.combat,step:`attackers`,attackerIds:[...r],lines:[...r].map(t=>({id:e(`line`),attackerId:t,blockerIds:[]}))}}}function jt(e,t,n){let r=e.combat.blockersByAttacker[t]||[];return{...e,combat:{...e.combat,step:`blockers`,blockersByAttacker:{...e.combat.blockersByAttacker,[t]:[...new Set([...r,n])]},lines:e.combat.lines.map(e=>e.attackerId===t?{...e,blockerIds:[...new Set([...e.blockerIds,n])]}:e)}}}function Mt(e){let t=e.battlefield.player.filter(t=>e.combat.attackerIds.includes(t.id)),n=e.battlefield.opponent,r=0,i=[];return t.forEach(t=>{let a=e.combat.blockersByAttacker[t.id]||[],o=n.filter(e=>a.includes(e.id)),s=o.reduce((e,t)=>e+(t.currentToughness||t.baseToughness||0),0),c=t.currentPower||t.basePower||0,l=o.length===0?c:Pt(t,`trample`)?Math.max(0,c-s):0;r+=l,i.push({attackerId:t.id,attackerName:t.name,damage:l,blockedBy:o.map(e=>e.name)})}),{total:r,details:i}}function Nt(t){let n=Mt(t);return{...t,combat:{...t.combat,step:`resolved`,damagePreview:n,resolvedDamage:n.total},effectLog:[{id:e(`combat`),at:Date.now(),sourceName:`Combat`,summary:`Resolved ${n.total} estimated combat damage.`},...t.effectLog]}}function Pt(e,t){return(e.keywords||[]).map(e=>e.toLowerCase()).includes(t)}var U={ENTER_BATTLEFIELD:`ENTER_BATTLEFIELD`,LAND_ENTERED_BATTLEFIELD:`LAND_ENTERED_BATTLEFIELD`,LANDFALL_CHECK:`LANDFALL_CHECK`,LEAVE_BATTLEFIELD:`LEAVE_BATTLEFIELD`,DESTROY:`DESTROY`,EXILE:`EXILE`,SACRIFICE:`SACRIFICE`,COUNTER_ADDED:`COUNTER_ADDED`,COUNTER_REMOVED:`COUNTER_REMOVED`,TOKEN_CREATED:`TOKEN_CREATED`,PHASE_CHANGED:`PHASE_CHANGED`,TURN_CHANGED:`TURN_CHANGED`,LIFE_CHANGED:`LIFE_CHANGED`,COMMANDER_DAMAGE_CHANGED:`COMMANDER_DAMAGE_CHANGED`,SPELL_CAST:`SPELL_CAST`,ABILITY_ACTIVATED:`ABILITY_ACTIVATED`,ATTACK_DECLARED:`ATTACK_DECLARED`,ATTACK_TRIGGER_CHECK:`ATTACK_TRIGGER_CHECK`,BLOCK_DECLARED:`BLOCK_DECLARED`},Ft=new Set;function It(t,n={},r={}){return{id:e(`evt`),eventType:t,timestamp:Date.now(),payload:n,sourceId:r.sourceId||``,playerId:r.playerId||``}}function Lt(e,t,n={},r={}){let i=It(t,n,r);return{...e,eventQueue:[...e.eventQueue||[],i],eventHistory:[i,...e.eventHistory||[]].slice(0,300)}}function Rt(e,t){let n={...e,eventQueue:[]};for(let r of e.eventQueue||[])n=t(n,r)||n;return n}function zt(e,t){let n=e;return Ft.forEach(e=>{let r=e(n,t);r&&(n=r)}),n}function Bt(e){return{ADD_PERMANENT:U.ENTER_BATTLEFIELD,ADD_CUSTOM_TOKEN:U.TOKEN_CREATED,TOGGLE_TAPPED:U.ABILITY_ACTIVATED,ADD_COUNTER:U.COUNTER_ADDED,ADD_COUNTER_SELECTED:U.COUNTER_ADDED,APPLY_COUNTER_SCOPE:U.COUNTER_ADDED,ADVANCE_PHASE:U.PHASE_CHANGED,LIFE_DELTA:U.LIFE_CHANGED,SET_LIFE:U.LIFE_CHANGED,COMMANDER_DAMAGE_DELTA:U.COMMANDER_DAMAGE_CHANGED,SET_COMMANDER_DAMAGE:U.COMMANDER_DAMAGE_CHANGED,CAST_SPELL:U.SPELL_CAST,DECLARE_ATTACKERS:U.ATTACK_DECLARED,ASSIGN_BLOCKER:U.BLOCK_DECLARED,REMOVE_SELECTED:U.LEAVE_BATTLEFIELD}[e]||``}var Vt=new Set([`SAVE_TICK`,`IMPORT_PROFILE`]),Ht=new Set([`SAVE_TICK`,`IMPORT_PROFILE`,`UNDO`]);function Ut(e,t){return!e||typeof e!=`object`?Gt({type:`UNKNOWN`},t):e.actionId&&e.actionType?e:Gt(e,t)}function Wt(e,t){return{...e,resultingStateReference:`${t.activeSession?.id||`session`}:${t.activeSession?.updatedAt||Date.now()}`}}function Gt(t,n){let r=t.type||t.actionType||`UNKNOWN`,i=qt({...t,type:void 0,actionType:void 0}),a=Kt(t);return{...t,type:r,actionType:r,payload:i,actionId:e(`action`),timestamp:Date.now(),playerId:n.player?.id||`local-player`,sourceId:t.sourceId||t.id||``,targetIds:a,resultingStateReference:``,replayable:!Vt.has(r),undoable:!Ht.has(r)}}function Kt(e){return Array.isArray(e.targetIds)?[...e.targetIds]:e.targetId?[e.targetId]:e.id?[e.id]:[]}function qt(e){let t={...e};return delete t.actionId,delete t.timestamp,delete t.playerId,delete t.sourceId,delete t.targetIds,delete t.resultingStateReference,delete t.replayable,delete t.undoable,t}function Jt(e=``){return String(e||``).split(/\r?\n/).map(e=>e.trim()).filter(Boolean).map(e=>{let t=e.match(/^(\d+)\s+(.+)$/);return t?{quantity:Number(t[1])||1,name:t[2].trim(),unresolvedDefinition:!0}:{quantity:1,name:e,unresolvedDefinition:!0}})}var Yt={id:`alpha`,name:`Alpha`,deckName:`Hearthhull Land Recursion Engine`,status:`static-assigned`,isPlaceholder:!1,commander:{name:`Hearthhull, the Worldseed`,role:`primary-commander`},backupCommander:{name:`Szarel, Genesis Shepherd`,role:`backup-commander`},strategy:{archetype:`Jund land sacrifice recursion landfall`,tags:[`landfall`,`sacrifice`,`graveyard-recursion`,`token-engine`,`attrition`],priorities:[`Prioritize land ramp and self-sacrificing lands.`,`Recursively return lands from graveyard to trigger landfall repeatedly.`,`Deploy sacrifice payoffs and token payoffs before recursion spikes.`,`Hold targeted removal for high-threat engines.`,`Close via landfall token swarms and sacrifice damage/drain payoffs.`],threatPriorityCards:[`The Gitrog Monster`,`Omnath, Locus of Rage`,`Rampaging Baloths`,`Splendid Reclamation`,`Aftermath Analyst`,`Titania, Protector of Argoth`,`Moraug, Fury of Akoum`],revengeLearningFocus:[`graveyard-hate`,`token-hate`,`landfall-hate`,`exile-removal`,`anti-sacrifice-locks`]},cards:Jt(`
1 Aftermath Analyst
1 Arcane Signet
1 Augur of Autumn
1 Baloth Prime
1 Beast Within
1 Binding the Old Gods
1 Blasphemous Act
1 Bojuka Bog
1 Braids, Arisen Nightmare
1 Cabaretti Courtyard
1 Canyon Slough
1 Centaur Vinecrasher
1 Cinder Glade
1 Command Tower
1 Cultivate
1 Dakmor Salvage
1 Escape to the Wilds
1 Escape Tunnel
1 Eumidian Hatchery
1 Eumidian Wastewaker
1 Evendo Brushrazer
1 Evolving Wilds
1 Exploration Broodship
1 Fabled Passage
1 Farseek
1 Festering Thicket
4 Forest
4 Forest
1 Formless Genesis
1 Gaze of Granite
1 God-Eternal Bontu
1 Groundskeeper
1 Hammer of Purphoros
1 Harrow
1 Horizon Explorer
1 Infernal Grasp
1 Juri, Master of the Revue
1 Karplusan Forest
1 Korvold, Fae-Cursed King
1 Llanowar Wastes
1 Loamcrafter Faun
1 Maestros Theater
1 Mayhem Devil
1 Mazirek, Kraul Death Priest
1 Moraug, Fury of Akoum
1 Mountain
2 Mountain
1 Mountain Valley
1 Multani, Yavimaya's Avatar
1 Myriad Landscape
1 Nature's Lore
1 Night's Whisper
1 Omnath, Locus of Rage
1 Oracle of Mul Daya
1 Pest Infestation
1 Planetary Annihilation
1 Putrefy
1 Rakdos Charm
1 Rampaging Baloths
1 Riveteers Overlook
1 Rocky Tar Pit
1 Roiling Regrowth
1 Satyr Wayfinder
1 Scouring Swarm
1 Sheltered Thicket
1 Skyshroud Claim
1 Smoldering Marsh
1 Sol Ring
1 Soul of Windgrace
1 Splendid Reclamation
1 Springbloom Druid
1 Sprouting Goblin
1 Sulfurous Springs
3 Swamp
2 Swamp
1 Szarel, Genesis Shepherd
1 Tear Asunder
1 Terramorphic Expanse
1 The Gitrog Monster
1 Tireless Tracker
1 Titania, Protector of Argoth
1 Twilight Mire
1 Uurg, Spawn of Turg
1 Vernal Fen
1 Viridescent Bog
1 Wastes
1 Windgrace's Judgment
1 World Breaker
1 Worldsoul's Rage
`)},Xt={id:`beta`,name:`Beta`,deckName:`Stella Lee Spellslinger Storm`,status:`static-assigned`,isPlaceholder:!1,commander:{name:`Stella Lee, Wild Card`,role:`primary-commander`},strategy:{archetype:`Izzet spellslinger copy-storm token payoffs`,tags:[`spellslinger`,`storm-threshold`,`cantrip`,`token-payoffs`,`spell-copy`],priorities:[`Sequence low-cost cantrips to hit second and third spell turns.`,`Develop payoff permanents before high-value spell chains.`,`Use copy effects on best-value instants/sorceries.`,`Protect Stella Lee and spell payoff engines.`,`Finish with copied burn/value turns and token pressure.`],threatPriorityCards:[`Guttersnipe`,`Electrostatic Field`,`Talrand, Sky Summoner`,`Murmuring Mystic`,`Third Path Iconoclast`,`Young Pyromancer`,`Storm-Kiln Artist`,`Archmage Emeritus`,`Veyran, Voice of Duality`,`Niv-Mizzet, Parun`],revengeLearningFocus:[`lifegain`,`graveyard-hate`,`anti-token-sweepers`,`counterspell-wars`,`commander-removal`]},cards:Jt(`
1 Arcane Bombardment
1 Arcane Denial
1 Arcane Signet
1 Archmage Emeritus
1 Baral's Expertise
1 Big Score
1 Bloodthirsty Adversary
1 Cascade Bluffs
1 Chaos Warp
1 Command Tower
1 Crackling Spellslinger
1 Curse of the Swine
1 Cursed Mirror
1 Deep Analysis
1 Dig Through Time
1 Electrostatic Field
1 Elemental Eruption
1 Epic Experiment
1 Eris, Roar of the Storm
1 Exotic Orchard
1 Expressive Iteration
1 Faithless Looting
1 Ferrous Lake
1 Finale of Promise
1 Finale of Revelation
1 Forger's Foundry
1 Frostboil Snarl
1 Galvanic Iteration
1 Goblin Electromancer
1 Guttersnipe
1 Haughty Djinn
14 Island
1 Izzet Boilerworks
1 Izzet Signet
1 Kaza, Roil Chaser
1 Leyline Dowser
1 Lock and Load
1 Midnight Clock
1 Mizzix's Mastery
13 Mountain
1 Murmuring Mystic
1 Niv-Mizzet, Parun
1 Octavia, Living Thesis
1 Opt
1 Ponder
1 Pongify
1 Preordain
1 Propaganda
1 Pteramander
1 Pyretic Charge
1 Radical Idea
1 Reliquary Tower
1 Rousing Refrain
1 Serum Visions
1 Shark Typhoon
1 Shivan Reef
1 Smoldering Stagecoach
1 Sol Ring
1 Storm-Kiln Artist
1 Sulfur Falls
1 Talrand, Sky Summoner
1 Temple of Epiphany
1 Temple of the False God
1 Tezzeret's Gambit
1 Think Twice
1 Third Path Iconoclast
1 Thunderclap Drake
1 Treasure Cruise
1 Vandalblast
1 Veyran, Voice of Duality
1 Volcanic Torrent
1 Windfall
1 Winged Boots
1 Young Pyromancer
`)},Zt={id:`omega`,name:`Omega`,deckName:`Zhulodok Colorless Eldrazi Ramp`,status:`static-assigned`,isPlaceholder:!1,commander:{name:`Zhulodok, Void Gorger`,role:`primary-commander`},backupCommander:{name:`Omarthis, Ghostfire Initiate`,role:`backup-commander`},strategy:{archetype:`Colorless Eldrazi ramp cascade bombs`,tags:[`colorless-ramp`,`mana-rocks`,`cascade`,`eldrazi`,`top-end-pressure`],priorities:[`Accelerate with mana rocks and colorless utility lands first.`,`Cast Zhulodok when immediate value/protection is likely.`,`Prioritize mana value 7+ colorless casts to trigger cascade, cascade.`,`Hold scarce removal for high-impact engines or blockers.`,`Close via giant attackers and repeated pressure.`],threatPriorityCards:[`Kozilek, the Great Distortion`,`Rise of the Eldrazi`,`Artisan of Kozilek`,`Bane of Bala Ged`,`It That Betrays`,`Steel Hellkite`,`Metalwork Colossus`,`Phyrexian Triniform`,`All Is Dust`],revengeLearningFocus:[`artifact-removal`,`exile-removal`,`commander-removal`,`fast-aggro`,`token-chump-walls`,`graveyard-recursion`]},cards:Jt(`
1 Abstruse Archaic
1 All Is Dust
1 Ancient Stone Idol
1 Arcane Lighthouse
1 Arch of Orazca
1 Artisan of Kozilek
1 Bane of Bala Ged
1 Blast Zone
1 Bonders' Enclave
1 Burnished Hart
1 Calamity of the Titans
1 Crashing Drawbridge
1 Darksteel Monolith
1 Desecrate Reality
1 Dreamstone Hedron
1 Duplicant
1 Eldrazi Temple
1 Endbringer
1 Endless Atlas
1 Endless One
1 Everflowing Chalice
1 Fireshrieker
1 Flayer of Loyalties
1 Forge of Heroes
1 Forsaken Monument
1 Geier Reach Sanitarium
1 Geode Golem
1 Guildless Commons
1 Hangarback Walker
1 Hedron Archive
1 Investigator's Journal
1 It That Betrays
1 Kaldra Compleat
1 Kozilek, the Great Distortion
1 Lightning Greaves
1 Mage-Ring Network
1 Matter Reshaper
1 Mazemind Tome
1 Metalwork Colossus
1 Meteor Golem
1 Mind Stone
1 Mirage Mirror
1 Mirrorpool
1 Myriad Construct
1 Mystic Forge
1 Not of This World
1 Oblivion Sower
1 Omarthis, Ghostfire Initiate
1 Ornithopter of Paradise
1 Palladium Myr
1 Perilous Vault
1 Phyrexian Triniform
1 Reliquary Tower
1 Rise of the Eldrazi
1 Rogue's Passage
1 Ruins of Oran-Rief
1 Scaretiller
1 Scavenger Grounds
1 Sea Gate Wreckage
1 Shrine of the Forsaken Gods
1 Skittering Cicada
1 Sol Ring
1 Solemn Simulacrum
1 Soul of New Phyrexia
1 Spatial Contortion
1 Steel Hellkite
1 Stonecoil Serpent
1 Suspicious Bookcase
1 Temple of the False God
1 Thought Vessel
1 Thran Dynamo
1 Titan's Presence
1 Tomb of the Spirit Dragon
1 Transmogrifying Wand
1 Tyrite Sanctum
1 Ugin, the Ineffable
1 Ugin's Mastery
1 Unstable Obelisk
1 Urza's Mine
1 Urza's Power Plant
1 Urza's Tower
1 War Room
1 Warping Wail
8 Wastes
7 Wastes
1 Worn Powerstone
`)},Qt=[`alpha`,`beta`,`omega`],$t={alpha:Yt,beta:Xt,omega:Zt};function en(e){return $t[e]||null}function tn(e){return(e?.cards||[]).reduce((e,t)=>e+(Number(t.quantity)||0),0)}function nn(e){let t=(e?.cards||[]).filter(e=>e.unresolvedDefinition).map(e=>({name:e.name,quantity:e.quantity||1}));return{mainboardCount:tn(e),unresolved:t}}var rn={step:{label:`Step`,intervalMs:250},normal:{label:`Normal`,intervalMs:1100},fast:{label:`Fast`,intervalMs:350}};function an(e=`normal`){return rn[e]?.intervalMs||rn.normal.intervalMs}function on(e,t={}){let n=g(),r=(Array.isArray(t.selectedOpponents)?t.selectedOpponents:[]).filter(e=>Qt.includes(e)),i=r.length?r:[`alpha`],a=String(t.speed||`normal`).toLowerCase(),o=Object.fromEntries(i.map(e=>[e,cn(e)])),s=i.map(e=>{let t=en(e),n=nn(t);return`${t?.name||e}: ${n.mainboardCount} cards${n.unresolved.length?` (${n.unresolved.length} unresolved)`:``}`}),c=[{id:`local-player`,name:e.player?.name||`Player`,authority:`host`,role:`player`},...i.map(e=>({id:e,name:o[e].name,authority:`guest`,role:`player`,publicBoardSnapshot:sn(o[e])}))];return n.simulation={enabled:!0,status:`running`,speed:rn[a]?a:`normal`,selectedOpponents:i,opponents:o,turnOrder:[`local-player`,...i],turnIndex:0,currentPlayerId:`local-player`,currentPhaseIndex:0,round:1,waitingForUser:!0,log:[W(`system`,`Simulation started. Your turn is active.`),W(`system`,`Deck integrity: ${s.join(` | `)}`)],createdAt:Date.now(),updatedAt:Date.now()},n.gameTracking={active:!0,startedAt:Date.now(),mode:`simulation-game`},n.phaseIndex=0,n.turn=1,{session:n,connectedPlayers:c}}function sn(e){return{id:e.id,name:e.name,life:e.life,deckName:e.deckName,currentPhase:f[e.currentPhaseIndex||0]||f[0],battlefieldCount:(e.zones?.battlefield||[]).length,updatedAt:Date.now()}}function W(t,n,r=``){return{id:e(`simlog`),actorId:t,text:n,detail:r,at:Date.now()}}function cn(e){let t=en(e)||{id:e,name:e,deckName:`${e} Deck Placeholder`,status:`placeholder`,isPlaceholder:!0,commander:{name:`${e} Commander Placeholder`,typeLine:`Legendary Creature`,manaCost:`{3}`,manaValue:3,power:3,toughness:3,role:`commander`,quantity:1},cards:[],strategy:{archetype:`Unknown`,tags:[],priorities:[],threatPriorityCards:[],revengeLearningFocus:[]}},n=ln(t.commander,t.id),r=un(t.cards||[],t.id),i=r.splice(0,7),a=nn(t);return{id:t.id,name:t.name,deckName:t.deckName,deckStatus:t.status||`placeholder`,isPlaceholder:!!t.isPlaceholder,strategy:t.strategy||{},commanderProfile:{primary:t.commander?.name||``,backup:t.backupCommander?.name||``},unresolvedCards:a.unresolved,deckMainboardCount:a.mainboardCount,life:40,commander:{card:n,zone:`command`,castCount:0,tax:0},commanderDamageFrom:{},zones:{library:r,hand:i,battlefield:[],graveyard:[],exile:[],command:[n]},landPlaysThisTurn:0,currentPhaseIndex:0,memory:{knownThreats:{},lossesToCommander:{}},updatedAt:Date.now()}}function ln(t,n=`npc`){let r=t.typeLine||mn(t.name||``),i=t.role||pn(r),a=Number.isFinite(Number(t.manaValue))?Number(t.manaValue):fn(t,r),o=!!(t.unresolvedDefinition||!t.typeLine);return{cardId:t.cardId||e(`simcard`),name:t.name||`Simulation Card Placeholder`,manaCost:t.manaCost||``,manaValue:a,typeLine:r||`Permanent`,power:Number.isFinite(Number(t.power))?Number(t.power):0,toughness:Number.isFinite(Number(t.toughness))?Number(t.toughness):0,oracleText:t.oracleText||``,keywords:Array.isArray(t.keywords)?t.keywords:[],role:i,quantity:1,owner:n,controller:n,unresolvedDefinition:o}}function un(e,t){return e.flatMap(e=>Array.from({length:Math.max(1,Number(e.quantity)||1)},(n,r)=>ln({...e,cardId:e.cardId||`${t}:${Cn(e.name||`card`)}:${r+1}`,quantity:1},t)))}function dn(e=``){return(String(e||``).match(/\d+|[WUBRGCX]/gi)||[]).reduce((e,t)=>/^\d+$/.test(t)?e+Number(t):e+1,0)}function fn(e={},t=``){if(Number.isFinite(Number(e.manaValue)))return Number(e.manaValue);let n=dn(e.manaCost||``);return n>0?n:/\bLand\b/i.test(t)?0:/\bInstant\b|\bSorcery\b/i.test(t)?2:/\bArtifact\b/i.test(t)?3:/\bCreature\b/i.test(t)||/\bEnchantment\b/i.test(t)?4:3}function pn(e=``){return/\bLand\b/i.test(e)?`land`:/\bInstant\b|\bSorcery\b/i.test(e)?`interaction`:/\bCreature\b/i.test(e)?`creature`:/\bArtifact\b/i.test(e)?`artifact`:/\bEnchantment\b/i.test(e)?`engine`:`permanent`}function mn(e=``){let t=String(e||``).trim().toLowerCase();return t?hn(t)?`Land`:_n.has(t)?`Instant`:vn.has(t)?`Sorcery`:yn.has(t)?`Enchantment`:bn.has(t)?`Artifact`:xn.has(t)?`Planeswalker`:Sn.has(t)?`Creature`:`Permanent`:`Permanent`}function hn(e){return/\bforest\b|\bisland\b|\bmountain\b|\bswamp\b|\bplains\b|\bwastes\b/.test(e)?!0:gn.has(e)}var gn=new Set(`bojuka bog.cabaretti courtyard.canyon slough.cinder glade.command tower.dakmor salvage.escape tunnel.evolving wilds.fabled passage.festering thicket.karplusan forest.llanowar wastes.maestros theater.mountain valley.myriad landscape.riveteers overlook.rocky tar pit.sheltered thicket.smoldering marsh.sulfurous springs.terramorphic expanse.twilight mire.vernal fen.viridescent bog.cascade bluffs.exotic orchard.ferrous lake.frostboil snarl.izzet boilerworks.reliquary tower.shivan reef.sulfur falls.temple of epiphany.temple of the false god.arcane lighthouse.arch of orazca.blast zone.bonders' enclave.eldrazi temple.forge of heroes.geier reach sanitarium.guildless commons.mage-ring network.mirrorpool.rogue's passage.ruins of oran-rief.scavenger grounds.sea gate wreckage.shrine of the forsaken gods.tomb of the spirit dragon.tyrite sanctum.urza's mine.urza's power plant.urza's tower.war room`.split(`.`)),_n=new Set([`beast within`,`infernal grasp`,`putrefy`,`rakdos charm`,`tear asunder`,`windgrace's judgment`,`arcane denial`,`big score`,`chaos warp`,`dig through time`,`galvanic iteration`,`opt`,`pongify`,`radical idea`,`think twice`,`treasure cruise`,`warping wail`,`spatial contortion`,`not of this world`,`titan's presence`]),vn=new Set(`blasphemous act.cultivate.escape to the wilds.farseek.gaze of granite.harrow.nature's lore.night's whisper.pest infestation.planetary annihilation.roiling regrowth.skyshroud claim.splendid reclamation.worldsoul's rage.baral's expertise.curse of the swine.deep analysis.elemental eruption.epic experiment.expressive iteration.faithless looting.finale of promise.finale of revelation.mizzix's mastery.ponder.preordain.serum visions.tezzeret's gambit.vandalblast.volcanic torrent.windfall.all is dust.desecrate reality.rise of the eldrazi`.split(`.`)),yn=new Set([`binding the old gods`,`hammer of purphoros`,`arcane bombardment`,`propaganda`,`shark typhoon`,`ugins mastery`,`forsaken monument`]),bn=new Set(`arcane signet.sol ring.cursed mirror.forger's foundry.izzet signet.midnight clock.winged boots.abstruse archaic.ancient stone idol.burnished hart.crashing drawbridge.darksteel monolith.dreamstone hedron.duplicant.endless atlas.everflowing chalice.fireshrieker.hangarback walker.hedron archive.investigator's journal.kaldra compleat.lightning greaves.mazemind tome.mind stone.mirage mirror.mystic forge.ornithopter of paradise.palladium myr.perilous vault.phyrexian triniform.stonecoil serpent.thought vessel.thran dynamo.transmogrifying wand.unstable obelisk.worn powerstone`.split(`.`)),xn=new Set([`ugin, the ineffable`]),Sn=new Set(`aftermath analyst.augur of autumn.baloth prime.braids, arisen nightmare.centaur vinecrasher.evendo brushrazer.god-eternal bontu.groundskeeper.horizon explorer.juri, master of the revue.korvold, fae-cursed king.loamcrafter faun.mayhem devil.mazirek, kraul death priest.moraug, fury of akoum.multani, yavimaya's avatar.omnath, locus of rage.oracle of mul daya.rampaging baloths.satyr wayfinder.scouring swarm.soul of windgrace.springbloom druid.sprouting goblin.the gitrog monster.tireless tracker.titania, protector of argoth.uurg, spawn of turg.world breaker.archmage emeritus.bloodthirsty adversary.crackling spellslinger.electrostatic field.eris, roar of the storm.goblin electromancer.guttersnipe.haughty djinn.kaza, roil chaser.leyline dowser.murmuring mystic.niv-mizzet, parun.octavia, living thesis.pteramander.storm-kiln artist.talrand, sky summoner.third path iconoclast.thunderclap drake.veyran, voice of duality.young pyromancer.artisan of kozilek.bane of bala ged.calamity of the titans.endbringer.endless one.flayer of loyalties.geode golem.it that betrays.kozilek, the great distortion.matter reshaper.metalwork colossus.meteor golem.myriad construct.oblivion sower.omarthis, ghostfire initiate.scaretiller.skittering cicada.solemn simulacrum.soul of new phyrexia.steel hellkite.suspicious bookcase`.split(`.`));function Cn(e){return String(e||`card`).toLowerCase().replace(/[^a-z0-9]+/g,`-`).replace(/^-|-$/g,``)}function wn(t,n,r={}){return L(b({...t,id:e(`simperm-${n}`),controller:n,owner:n,ownedByCommanderDeck:!0,zone:`battlefield`,sourcePermanentId:r.sourcePermanentId||``,createdByTriggerId:r.createdByTriggerId||``,tokenTemplateId:r.tokenTemplateId||``,tokenCopyOfId:r.tokenCopyOfId||``}))}function Tn(e,t){let r=t.actionType||t.type,i=[`IMPORT_PROFILE`,`SAVE_TICK`].includes(r)?e:Vr(e,t),a=i;switch(r){case`IMPORT_PROFILE`:return t.profile;case`UNDO`:return Hr(e);case`REDO`:return Ur(e);case`REPLAY_TO_ACTION`:a=Wr(i,t.replayActionId||t.payload?.replayActionId||``);break;case`SET_PLAYER_NAME`:a={...i,player:{...i.player,name:t.name||`Player`}};break;case`SET_SETTING`:a=Nn(i,t.path,t.value);break;case`SET_MULTIPLAYER_MODE`:a=Pn(i,t.mode);break;case`START_GAME_TRACKING`:a=q(i,lr(i.activeSession));break;case`STOP_GAME_TRACKING`:a=q(i,ur(i.activeSession));break;case`ACTIVATE_BOARD`:a=q(i,dr(zr(i.activeSession,i.settings)));break;case`START_SIMULATION`:a=Fn(i,t);break;case`SIMULATION_PAUSE`:a=In(i,`paused`);break;case`SIMULATION_RESUME`:a=In(i,`running`);break;case`SIMULATION_STOP`:a=Rn(i);break;case`SIMULATION_SET_SPEED`:a=Ln(i,t.speed);break;case`SIMULATION_PASS_TURN`:a=q(i,Wn(i.activeSession,`manual-pass`));break;case`SIMULATION_TICK`:a=q(i,zn(i.activeSession,i.simulationMemory||{}));break;case`LIFE_DELTA`:a=q(i,{...i.activeSession,life:Math.max(0,i.activeSession.life+Number(t.amount||0))});break;case`PLAYER_COUNTER_DELTA`:a=q(i,tr(i.activeSession,t.counter,t.amount));break;case`COMMANDER_DAMAGE_DELTA`:a=q(i,nr(i.activeSession,t.opponentId||`opponent`,t.amount));break;case`SET_COMMANDER_DAMAGE`:a=q(i,rr(i.activeSession,t.opponentId||`opponent`,t.value));break;case`RESET_PLAYER_TRACKERS`:a=q(i,ir(i.activeSession));break;case`SET_LIFE`:a=q(i,{...i.activeSession,life:n(t.life,40)});break;case`ADD_COUNTER`:a=q(i,vr(i.activeSession,t));break;case`ADD_COUNTER_SELECTED`:a=q(i,ar(i.activeSession,t));break;case`APPLY_COUNTER_SCOPE`:a=or(i,t);break;case`ADD_MANA`:a=q(i,yr(i.activeSession,t.color,t.amount));break;case`CLEAR_MANA`:a=q(i,{...i.activeSession,manaPool:_()});break;case`ADVANCE_PHASE`:a=q(i,gr(zr(i.activeSession,i.settings)));break;case`ADD_PERMANENT`:a=En(i,t.card,t.controller||`player`);break;case`ADD_CUSTOM_TOKEN`:a=En(i,Mn(t),t.controller||`player`);break;case`CAST_SPELL`:a=q(i,Ue(zr(i.activeSession,i.settings),t.card)),a=kt(a,{...t.card,owner:`player`,controller:`player`});break;case`ATTACH_PERMANENT`:a=q(i,_r(i.activeSession,t.sourceId,t.targetId));break;case`TOGGLE_TAPPED`:a=q(i,Cr(i.activeSession,t.id));break;case`SET_SELECTED_TAPPED`:a=q(i,wr(i.activeSession,!!t.tapped));break;case`REMOVE_SELECTED`:a=q(i,Tr(i.activeSession,t));break;case`CLEAR_SELECTION`:a=q(i,{...i.activeSession,selectedIds:[]});break;case`SELECT_PERMANENT`:a=q(i,kr(i.activeSession,t.id));break;case`REORDER_PERMANENT`:a=q(i,Ar(i.activeSession,t.id,t.direction));break;case`DECLARE_ATTACKERS`:a=q(i,On(zr(At(i.activeSession,t.ids||[]),i.settings),t.ids||[]));break;case`ASSIGN_BLOCKER`:a=q(i,jt(i.activeSession,t.attackerId,t.blockerId));break;case`RESOLVE_COMBAT`:a=q(i,Nt(i.activeSession));break;case`SET_COMMANDER`:a=wt(i,t.card);break;case`CAST_COMMANDER`:a=Tt(i);break;case`ADD_DECK_CARD`:a=Ot(i,t.card,t.source||`manual`);break;case`MARK_PENDING_EFFECT`:a=q(i,jr(i.activeSession,t.id,t.status));break;case`HELPER_REMIND_ME`:a=q(i,Mr(i.activeSession,t.messages||[]));break;case`HELPER_DISMISS_MESSAGE`:a=q(i,Nr(i.activeSession,t.messageKey||``));break;case`HELPER_MARK_SHOWN`:a=q(i,Pr(i.activeSession,t.messageKey||``));break;case`TRIGGER_QUEUE_RESOLVE`:a=q(i,He(i.activeSession,{triggerId:t.id,command:`resolve`,requestedBy:t.playerId||`player`}));break;case`TRIGGER_QUEUE_SKIP`:a=q(i,He(i.activeSession,{triggerId:t.id,command:`skip`,requestedBy:t.playerId||`player`}));break;case`TRIGGER_QUEUE_DELAY`:a=q(i,He(i.activeSession,{triggerId:t.id,command:`delay`,requestedBy:t.playerId||`player`}));break;case`TRIGGER_QUEUE_REACTIVATE_DELAYED`:a=q(i,Fr(i.activeSession));break;case`ARCHIVE_GAME`:a=re(i,t.result||`completed`);break;case`SYNC_PUBLIC_STATS`:a=cr(i);break;default:a=i;break}return a=q(a,Ir(zr(a.activeSession,a.settings),t,r)),a=pr(a,t,r),a=mr(a,i.activeSession,r),a=hr(a),Br(a,Wt(t,a))}function En(e,t,n){let r=L({...t,controller:n,owner:t.owner||n}),i=n===`player`?`player`:`opponent`,a=q(e,Dn(zr({...e.activeSession,battlefield:{...e.activeSession.battlefield,[i]:kn(e.activeSession.battlefield[i],r)}},e.settings),r,{instances:r.quantity,cause:`add-permanent`}));return n===`player`?kt(a,r):a}function Dn(t,n,{instances:r=1,cause:i=`effect`,chainId:a=e(`chain`)}={}){let o={permanent:n,instances:r,cause:i,controller:n.controller},s=z(t,{type:`permanent-entered`,eventType:`ENTER_BATTLEFIELD`,permanent:n,payload:o,instances:r,cause:i,chainId:a});return n.isLand&&(s=z(s,{type:`land-entered-battlefield`,eventType:`LAND_ENTERED_BATTLEFIELD`,permanent:n,payload:o,instances:r,cause:i,chainId:a}),s=z(s,{type:`landfall-check`,eventType:`LANDFALL_CHECK`,permanent:n,payload:o,instances:r,cause:i,chainId:a})),s}function On(t,n=[]){let r={attackerIds:[...n],phase:f[t.phaseIndex],attackingPlayerId:`opponent`,attackedObjectId:`opponent`},i=e(`chain`);return z(z(t,{type:`attackers-declared`,eventType:`ATTACK_DECLARED`,payload:r,ids:[...n],chainId:i}),{type:`attack-trigger-check`,eventType:`ATTACK_TRIGGER_CHECK`,payload:r,ids:[...n],chainId:i})}function kn(e,t){let n=e.findIndex(e=>An(e)===An(t));return n<0?[...e,Sr(t)]:e.map((e,r)=>r===n?L({...e,quantity:(e.quantity||1)+(t.quantity||1),stackMembers:[...e.stackMembers||[],...Sr(t).stackMembers||[]]}):e)}function An(e){return JSON.stringify({name:e.name,cardId:e.cardId,typeLine:e.typeLine,oracleText:e.oracleText,controller:e.controller,owner:e.owner,basePower:e.basePower,baseToughness:e.baseToughness,counters:jn(e.counters),keywords:[...e.keywords||[]].sort(),tapped:e.tapped,summoningSick:e.summoningSick,attacking:e.attacking,blocking:e.blocking,enteredDuringCombat:e.enteredDuringCombat,attackingPlayerId:e.attackingPlayerId,attackedObjectId:e.attackedObjectId,createdByTriggerId:e.createdByTriggerId,sourcePermanentId:e.sourcePermanentId,combatPhaseCreatedIn:e.combatPhaseCreatedIn,tokenTemplateId:e.tokenTemplateId,tokenCopyOfId:e.tokenCopyOfId,attachedToId:e.attachedToId,attachments:[...e.attachments||[]].sort(),temporaryModifiers:e.temporaryModifiers||[],manualStatus:e.manualStatus,isToken:e.isToken,isCopy:e.isCopy})}function jn(e={}){return Object.fromEntries(Object.entries(e).sort(([e],[t])=>e.localeCompare(t)))}function Mn(e){let t=e.tokenType||`Creature`,r=/\bToken\b/i.test(t)?t:`Token ${t}`;return{name:e.name||`Custom Token`,typeLine:r,basePower:e.power,baseToughness:e.toughness,quantity:n(e.quantity,1)||1,tapped:!!e.tapped,isToken:!0,ownedByCommanderDeck:!1}}function Nn(e,t,n){let r=String(t||``).split(`.`).filter(Boolean);if(!r.length)return e;let i={...e.settings||{}},a=i;return r.slice(0,-1).forEach(e=>{a[e]={...a[e]||{}},a=a[e]}),a[r[r.length-1]]=n,t===`adhdMode.enabled`&&(i.adhdAutomation=!!n),t===`adhdAutomation`&&(i.adhdMode={...i.adhdMode||{},enabled:!!n}),{...e,settings:i}}function Pn(e,t=`offline`){let n=e.settings?.multiplayer||{},r=e.activeSession?.simulation||{},i=t===`simulated`?$n(e,r.opponents||{}):[{id:`local-player`,name:e.player?.name||`Player`,authority:`host`,role:n.role||`player`}];return{...e,activeSession:{...e.activeSession,simulation:t===`simulated`?r:{...r,enabled:!1,status:`stopped`,waitingForUser:!1}},settings:{...e.settings||{},multiplayer:{...n,mode:t,connectedPlayers:i}}}}function Fn(e,t={}){let n=on(e,{selectedOpponents:t.selectedOpponents||e.settings?.multiplayer?.selectedSimulatedOpponents||[],speed:t.speed||e.settings?.multiplayer?.simulatedSpeed||`normal`}),r=n.connectedPlayers||$n(e,n.session.simulation.opponents||{});return{...e,activeSession:n.session,settings:{...e.settings||{},multiplayer:{...e.settings?.multiplayer||{},mode:`simulated`,connectedPlayers:r,selectedSimulatedOpponents:[...n.session.simulation.selectedOpponents||[]],simulatedSpeed:n.session.simulation.speed||`normal`}}}}function In(e,t=`paused`){let n=e.activeSession?.simulation;return n?.enabled?q(e,{...e.activeSession,simulation:G({...n,status:t,updatedAt:Date.now()},W(`system`,t===`running`?`Simulation resumed.`:`Simulation paused.`))}):e}function Ln(e,t=`normal`){let n=e.activeSession?.simulation;return n?.enabled?{...q(e,{...e.activeSession,simulation:{...n,speed:t,updatedAt:Date.now()}}),settings:{...e.settings||{},multiplayer:{...e.settings?.multiplayer||{},simulatedSpeed:t}}}:e}function Rn(e){let t=e.activeSession?.simulation;if(!t?.enabled)return e;let n=G({...t,enabled:!1,status:`stopped`,waitingForUser:!1,updatedAt:Date.now()},W(`system`,`Simulation stopped.`));return{...q(e,{...e.activeSession,simulation:n,gameTracking:{active:!1,startedAt:e.activeSession?.gameTracking?.startedAt||0,mode:`training-ground`}}),settings:{...e.settings||{},multiplayer:{...e.settings?.multiplayer||{},mode:`offline`,connectedPlayers:[{id:`local-player`,name:e.player?.name||`Player`,authority:`host`,role:`player`}]}}}}function zn(e,t={}){let n=e.simulation||{};if(!n.enabled||n.status!==`running`)return e;let r=n.currentPlayerId||n.turnOrder?.[n.turnIndex]||`local-player`;if(r===`local-player`)return n.waitingForUser?e:{...e,simulation:G({...n,waitingForUser:!0,updatedAt:Date.now()},W(`system`,`Your turn: play normally, then pass turn from simulation controls.`))};let i=n.opponents?.[r];if(!i)return{...e,simulation:G({...n,status:`paused`,waitingForUser:!0,updatedAt:Date.now()},W(`system`,`Simulation paused: missing NPC state for ${r}.`))};let a=Number.isFinite(Number(n.currentPhaseIndex))?Number(n.currentPhaseIndex):0;return a===0?Bn(e,i,n):a===1?Vn(e,i,n,t):a===2?Hn(e,i,n):a===3?Un(e,i,n,t):Wn(e,`npc-end-step`)}function Bn(e,t,n){let[r,...i]=t.zones.library||[],a={...t,zones:{...t.zones,library:i,hand:r?[...t.zones.hand||[],r]:[...t.zones.hand||[]]},currentPhaseIndex:1,landPlaysThisTurn:0,updatedAt:Date.now()};return{...e,phaseIndex:0,simulation:G(er(n,a,{currentPhaseIndex:1,updatedAt:Date.now()}),W(t.id,r?`${t.name} draws ${r.name}.`:`${t.name} tries to draw but has no cards.`))}}function Vn(e,t,n,r={}){let i=e,a={...t},o=`${t.name} passes Main 1.`,s=(a.zones.hand||[]).findIndex(e=>K(e,`Land`));if(s>=0&&(a.landPlaysThisTurn||0)<1){let e=a.zones.hand[s];a.zones.hand=a.zones.hand.filter((e,t)=>t!==s),i=Zn(i,e,t.id),a.zones.battlefield=[...a.zones.battlefield||[],e],a.landPlaysThisTurn=1,o=`${t.name} plays ${e.name}.`}else{let e=qn(i,a);if(e)i=e.session,a=e.npc,o=`${t.name} casts commander ${a.commander.card.name}${a.commander.tax>0?` (tax ${a.commander.tax})`:``}.`;else{let e=Kn(a,i,r,{secondary:!1});if(e>=0){let n=a.zones.hand[e];a.zones.hand=a.zones.hand.filter((t,n)=>n!==e);let s=Gn(i,a,n,r);i=s.session,a=s.npc,o=`${t.name} casts ${n.name}.`}}}return a.currentPhaseIndex=2,a.updatedAt=Date.now(),{...i,phaseIndex:1,simulation:G(er(n,a,{currentPhaseIndex:2,updatedAt:Date.now()}),W(t.id,o))}}function Hn(e,t,n){let r=(e.battlefield.opponent||[]).filter(e=>e.controller===t.id&&e.isCreature&&!e.tapped&&!e.summoningSick),i=+!!(t.strategy?.tags||[]).some(e=>[`spellslinger`,`landfall`,`colorless-ramp`].includes(e)),a=Math.max(1,Math.min(r.length,3+i)),o=r.slice().sort((e,t)=>(t.currentPower||t.basePower||0)-(e.currentPower||e.basePower||0)).slice(0,a),s=e,c=0;if(o.length){let e=new Set(o.map(e=>e.id));s={...s,battlefield:{...s.battlefield,opponent:s.battlefield.opponent.map(t=>e.has(t.id)?b({...t,tapped:!0,attacking:!0}):t)},combat:{...s.combat||{},step:`attackers`,attackerIds:[...new Set([...s.combat?.attackerIds||[],...o.map(e=>e.id)])]}},c=o.reduce((e,t)=>e+Number(t.currentPower||t.basePower||0),0),s={...s,life:Math.max(0,s.life-Math.max(0,c))}}let l={...t,currentPhaseIndex:3,updatedAt:Date.now()};return{...s,phaseIndex:2,simulation:G(er(n,l,{currentPhaseIndex:3,updatedAt:Date.now()}),W(t.id,o.length?`${t.name} attacks for ${c}.`:`${t.name} skips combat.`))}}function Un(e,t,n,r={}){let i=e,a={...t},o=`${t.name} passes Main 2.`,s=qn(i,a,{conservative:!0});if(s)i=s.session,a=s.npc,o=`${t.name} casts commander ${a.commander.card.name} in Main 2.`;else{let e=Kn(a,i,r,{secondary:!0});if(e>=0){let n=a.zones.hand[e];a.zones.hand=a.zones.hand.filter((t,n)=>n!==e);let s=Gn(i,a,n,r);i=s.session,a=s.npc,o=`${t.name} casts ${n.name} in Main 2.`}}return a.currentPhaseIndex=4,a.updatedAt=Date.now(),{...i,phaseIndex:3,simulation:G(er(n,a,{currentPhaseIndex:4,updatedAt:Date.now()}),W(t.id,o))}}function Wn(e,t=`end-step`){let n=e.simulation||{};if(!n.enabled)return e;let r=n.turnOrder||[`local-player`],i=((n.turnIndex||0)+1)%r.length,a=r[i]||`local-player`,o=Math.max(n.round||1,e.turn||1),s=i===0?o+1:o,c=Object.fromEntries(Object.entries(n.opponents||{}).map(([e,t])=>[e,{...t,landPlaysThisTurn:0,currentPhaseIndex:e===a?0:t.currentPhaseIndex||0,updatedAt:Date.now()}])),l=a===`local-player`?`Your turn started.`:`${c[a]?.name||a} turn started.`,u=G({...n,opponents:c,turnIndex:i,currentPlayerId:a,currentPhaseIndex:0,waitingForUser:a===`local-player`,round:s,updatedAt:Date.now()},W(a===`local-player`?`system`:a,l,t));return{...e,turn:s,phaseIndex:4,combat:{...e.combat||{},attackerIds:[],blockersByAttacker:{},lines:[]},battlefield:{...e.battlefield,opponent:(e.battlefield.opponent||[]).map(e=>b({...e,attacking:!1,blocking:!1,summoningSick:!1}))},simulation:u}}function Gn(t,n,r,i={}){if(K(r,`Instant`)||K(r,`Sorcery`)){let a=Qn(t,i);if(a){let i=new Set([a]),o=Tr({...t,selectedIds:[...i]},{mode:`destroy`,countMode:`single`});return{session:{...o,effectLog:[{id:e(`sim-effect`),at:Date.now(),sourceName:n.name,summary:`${n.name} uses ${r.name} on a high-threat target.`},...o.effectLog||[]].slice(0,120)},npc:{...n,zones:{...n.zones,graveyard:[...n.zones?.graveyard||[],r]}}}}return{session:t,npc:{...n,zones:{...n.zones,graveyard:[...n.zones?.graveyard||[],r]}}}}return{session:Zn(t,r,n.id),npc:{...n,zones:{...n.zones,battlefield:[...n.zones?.battlefield||[],r]}}}}function Kn(e,t,n={},r={}){let i=e.zones.hand||[];if(!i.length)return-1;let a=Xn(t,e.id),o=i.map((e,t)=>({card:e,index:t})).filter(({card:e})=>!K(e,`Land`)&&Number(e.manaValue||0)<=a);return o.length?o.map(t=>({...t,score:Yn(t.card,n,{...r,npc:e})})).sort((e,t)=>t.score-e.score)[0]?.index??-1:-1}function qn(e,t,n={}){if(t.commander?.zone!==`command`||!t.commander?.card)return null;let r=Xn(e,t.id),i=Number(t.commander.card.manaValue||0)+Number(t.commander.tax||0);if(!Number.isFinite(i)||i<=0||i>r||n.conservative&&r<=i+1)return null;let a={...t.commander.card,unresolvedDefinition:!1};return{session:Zn(e,a,t.id),npc:{...t,commander:{...t.commander,zone:`battlefield`,castCount:Number(t.commander.castCount||0)+1},zones:{...t.zones,command:[],battlefield:[...t.zones?.battlefield||[],a]}}}}function Jn(e){return new Set((e?.strategy?.tags||[]).map(e=>String(e||``).toLowerCase()))}function Yn(e,t={},n={}){let r=1,i=Jn(n.npc),a=new Set((n.npc?.strategy?.threatPriorityCards||[]).map(e=>String(e||``).toLowerCase()));return K(e,`Creature`)&&(r+=4),(K(e,`Instant`)||K(e,`Sorcery`))&&(r+=3),(K(e,`Artifact`)||K(e,`Enchantment`))&&(r+=2),a.has(String(e.name||``).toLowerCase())&&(r+=6),i.has(`landfall`)&&/land|reclamation|tracker|baloths|gitrog/i.test(e.name||``)&&(r+=4),i.has(`spellslinger`)&&(K(e,`Instant`)||K(e,`Sorcery`))&&(r+=3),i.has(`colorless-ramp`)&&(K(e,`Artifact`)||/eldrazi|kozilek|ugin/i.test(e.name||``))&&(r+=4),(t.patterns?.tokenStrategy||0)>=2&&/destroy|exile/i.test(e.oracleText||``)&&(r+=4),n.secondary&&--r,r}function Xn(e,t){return(e.battlefield.opponent||[]).reduce((e,n)=>n.controller===t?n.isLand?e+(n.quantity||1):n.isArtifact&&/mana|ramp|relic/i.test(`${n.name} ${n.oracleText}`)?e+1:e:e,0)}function Zn(t,n,r){let i=wn(n,r),a=Dn({...t,battlefield:{...t.battlefield,opponent:kn(t.battlefield.opponent||[],i)}},i,{instances:i.quantity||1,cause:`simulation-cast`});return n.unresolvedDefinition?{...a,effectLog:[{id:e(`sim-unresolved`),at:Date.now(),sourceName:`Simulation Parser`,summary:`Unresolved card definition retained for ${n.name}.`,status:`manual-choice-required`},...a.effectLog||[]].slice(0,160)}:a}function Qn(e,t={}){let n=e.battlefield.player||[];if(!n.length)return``;let r=t.cardThreat||{},i=t.repeatedWinConditions||{};return n.map(e=>{let t=Number(r[e.name]||0);return t+=Number(i[e.name]||0),e.isCommander&&(t+=5),e.isToken&&(t+=2),(e.currentPower||e.basePower||0)>=5&&(t+=3),/doubling season|cathars' crusade|scute swarm/i.test(e.name||``)&&(t+=6),{id:e.id,score:t}}).sort((e,t)=>t.score-e.score)[0]?.id||``}function $n(e,t={}){return[{id:`local-player`,name:e.player?.name||`Player`,authority:`host`,role:`player`},...Object.values(t).map(e=>({id:e.id,name:e.name,authority:`guest`,role:`player`,publicBoardSnapshot:sn(e)}))]}function G(e,t){return{...e,log:[t,...e.log||[]].slice(0,120),updatedAt:Date.now()}}function er(e,t,n={}){return{...e,opponents:{...e.opponents||{},[t.id]:t},...n}}function K(e,t){return String(e?.typeLine||``).toLowerCase().includes(String(t||``).toLowerCase())}function tr(e,t=`custom`,r=1){let i=n(e.playerCounters?.[t]);return{...e,playerCounters:{...e.playerCounters||{},[t]:Math.max(0,i+Number(r||0))}}}function nr(e,t,r=1){let i=n(e.commander.damageByOpponent?.[t]);return{...e,commander:{...e.commander,damageByOpponent:{...e.commander.damageByOpponent||{},[t]:Math.max(0,i+Number(r||0))}}}}function rr(e,t,r=0){return{...e,commander:{...e.commander,damageByOpponent:{...e.commander.damageByOpponent||{},[t]:n(r)}}}}function ir(e){return{...e,life:40,playerCounters:{},manaPool:_(),commander:{...e.commander,damageByOpponent:{}}}}function ar(e,t){return(e.selectedIds||[]).reduce((e,n)=>vr(e,{...t,id:n}),e)}function or(e,t){let r=String(t.counterType||`+1/+1`).trim()||`+1/+1`,i=Math.max(1,n(t.amount,1)),a=t.scope||`selected`,o=sr(e.activeSession,{scope:a,counterType:r,amount:i}),s=[r,...(e.settings?.recentCounterTypes||[]).filter(e=>e!==r)].slice(0,5);return{...q(e,o),settings:{...e.settings||{},recentCounterTypes:s}}}function sr(e,t){let r=new Set(e.selectedIds||[]),i=e=>t.scope===`all-creatures`?e.isCreature:t.scope===`all-permanents`?!0:t.scope===`all-tokens`?e.isToken:r.has(e.id),a=e=>e.map(e=>i(e)?L({...e,counters:{...e.counters,[t.counterType]:n(e.counters?.[t.counterType])+t.amount}}):e);return R({...e,battlefield:{...e.battlefield,player:a(e.battlefield.player),opponent:a(e.battlefield.opponent)}})}function cr(e){let t=e.activeSession,n={playerName:e.player?.name||`Player`,life:t.life,turn:t.turn,boardSize:t.battlefield.player.reduce((e,t)=>e+t.quantity,0),actionsThisGame:t.history.length,triggersResolved:t.effectLog.length,syncedAt:Date.now()},r=e.settings?.multiplayer?.connectedPlayers||[];return{...e,statsSync:{lastSyncedAt:Date.now(),publicSummary:n,peers:r.filter(e=>e.id!==`local-player`).map(e=>({id:e.id,name:e.name,boardSize:n.boardSize,comparedAt:Date.now()}))}}}function lr(t){if(t.gameTracking?.active)return t;let n=Date.now();return{...t,gameTracking:{active:!0,startedAt:n,mode:`active-game`},effectLog:[{id:e(`game-start`),at:n,sourceName:`Game Tracking`,summary:`Game tracking started.`},...t.effectLog||[]].slice(0,120)}}function ur(t){if(!t.gameTracking?.active)return t;let n=Date.now();return{...t,gameTracking:{active:!1,startedAt:t.gameTracking?.startedAt||0,mode:`training-ground`},effectLog:[{id:e(`game-stop`),at:n,sourceName:`Game Tracking`,summary:`Game tracking stopped. Training ground remains active.`},...t.effectLog||[]].slice(0,120)}}function dr(t){let n=R(t),r=fr(n),i=[...r,...n.pendingEffects||[]].slice(0,120);return{...n,pendingEffects:i,effectLog:[{id:e(`board-activate`),at:Date.now(),sourceName:`Training Ground`,summary:`Activate Board evaluated ${Gr(n).length} permanents and queued ${r.length} manual choice item(s).`},...n.effectLog||[]].slice(0,160)}}function fr(t){let n=new Set((t.pendingEffects||[]).map(e=>`${e.sourceId}:${e.effect?.action||e.summary}`)),r=[];return Gr(t).forEach(t=>{(t.parsedEffects||[]).forEach(i=>{if(!i.manual)return;let a=`${t.id}:${i.action||i.reason||`manual`}`;n.has(a)||(n.add(a),r.push({id:e(`pending`),sourceId:t.id,sourceName:t.name,effect:i,summary:`manual choice required: ${i.reason||i.summary||i.action||`effect`}`,status:`pending`,createdAt:Date.now(),eventType:`BOARD_ACTIVATE`,triggerId:``}))})}),r}function pr(e,t,r){if(t?.internalOnly||!e?.activeSession?.simulation?.enabled)return e;let i={...e.simulationMemory||{},patterns:{...e.simulationMemory?.patterns||{}},cardThreat:{...e.simulationMemory?.cardThreat||{}},repeatedWinConditions:{...e.simulationMemory?.repeatedWinConditions||{}},updatedAt:Date.now()},a=(e,t=1)=>{i.patterns[e]=n(i.patterns[e],0)+t},o=(e,t=1)=>{e&&(i.cardThreat[e]=n(i.cardThreat[e],0)+t)},s=(e,t=1)=>{e&&(i.repeatedWinConditions[e]=n(i.repeatedWinConditions[e],0)+t)};if(r===`ADD_CUSTOM_TOKEN`&&a(`tokenStrategy`,n(t.quantity,1)),r===`ADD_PERMANENT`){let e=String(t.card?.typeLine||``).toLowerCase();e.includes(`land`)&&a(`landfallStrategy`),e.includes(`artifact`)&&a(`artifactsStrategy`),e.includes(`enchantment`)&&a(`enchantmentsStrategy`),e.includes(`creature`)&&o(t.card?.name,1),/doubling season|cathars' crusade|scute swarm/i.test(t.card?.name||``)&&(a(`comboEngineStrategy`,2),o(t.card?.name,3),s(t.card?.name,1)),/omnath, locus of rage|rampaging baloths|the gitrog monster|stella lee, wild card|zhulodok, void gorger/i.test(t.card?.name||``)&&s(t.card?.name,2)}return r===`LIFE_DELTA`&&Number(t.amount||0)>0&&a(`lifegainStrategy`),r===`ADD_MANA`&&Number(t.amount||0)>=2&&a(`fastManaStrategy`),r===`COMMANDER_DAMAGE_DELTA`&&Number(t.amount||0)>0&&a(`commanderDamageStrategy`),r===`REMOVE_SELECTED`&&String(t.mode||``).toLowerCase()===`destroy`&&a(`boardWipeStrategy`),{...e,simulationMemory:i}}function mr(e,t,n){let r=e.activeSession?.simulation;if(!r?.enabled||r.status!==`running`||r.currentPlayerId!==`local-player`||![`ADVANCE_PHASE`,`SIMULATION_PASS_TURN`].includes(n)||n===`SIMULATION_PASS_TURN`)return e;let i=t?.turn||0;return e.activeSession.turn<=i||e.activeSession.phaseIndex!==0?e:q(e,Wn({...e.activeSession,simulation:{...r,round:Math.max(r.round||1,e.activeSession.turn||1),waitingForUser:!1}},`local-turn-complete`))}function hr(e){let t=e.activeSession?.simulation;return t?.enabled?{...e,settings:{...e.settings||{},multiplayer:{...e.settings?.multiplayer||{},mode:`simulated`,connectedPlayers:$n(e,t.opponents||{})}}}:e}function gr(e){let t=d(e),n=t.turn!==e.turn,r=e.helper||{},i=n&&t.phaseIndex===0&&!!r.reminderRequested&&Array.isArray(r.reminderQueue)&&r.reminderQueue.length>0,a={...t,manaPool:_(),battlefield:{...t.battlefield,player:t.battlefield.player.map(e=>({...e,tapped:n?!1:e.tapped,summoningSick:n?!1:e.summoningSick,attacking:!1,blocking:!1,temporaryModifiers:t.phaseIndex===0?[]:e.temporaryModifiers}))},helper:i?{...r,reminderRequested:!1,replayQueue:r.reminderQueue,reminderQueue:[]}:r},o=Fr(n?Lt(a,`TURN_CHANGED`,{turn:a.turn}):a);return z(o,{type:`phase-changed`,phase:f[o.phaseIndex],eventType:`PHASE_CHANGED`,payload:{phase:f[o.phaseIndex]}})}function _r(e,t,n){return R(br(br(e,t,e=>({...e,attachedToId:n,relationships:{...e.relationships||{},attachedToId:n}})),n,e=>({...e,attachments:[...new Set([...e.attachments||[],t])],relationships:{...e.relationships||{},attachedIds:[...new Set([...e.relationships?.attachedIds||[],t])]}})))}function vr(e,t){return xr(e,t.id,e=>({...e,counters:{...e.counters,[t.counterType||`+1/+1`]:n(e.counters?.[t.counterType||`+1/+1`])+n(t.amount,1)}}))}function yr(e,t,r=1){let i=[`W`,`U`,`B`,`R`,`G`,`C`,`Generic`].includes(t)?t:`C`,a=Number.isFinite(Number(r))?Math.trunc(Number(r)):1,o=n(e.manaPool?.[i]);return{...e,manaPool:{...e.manaPool,[i]:Math.max(0,o+a)}}}function br(e,t,n){let r=e=>e.map(e=>e.id===t?L(n(e)):e);return R({...e,battlefield:{...e.battlefield,player:r(e.battlefield.player),opponent:r(e.battlefield.opponent)}})}function xr(t,n,r){let i=!1,a={...t.battlefield};return[`player`,`opponent`].forEach(o=>{if(i)return;let s=t.battlefield[o],c=s.findIndex(e=>e.id===n);if(c<0)return;let l=s[c],u=[...l.stackMembers||[]];if((l.quantity||u.length)<=1||u.length<=1){a[o]=s.map(e=>e.id===n?L(r(e)):e),i=!0;return}let[d,...f]=u,p=L({...l,quantity:Math.max(1,(l.quantity||u.length)-1),stackMembers:f.length?f:u.slice(1)}),m=L({...r({...l,id:e(`perm`),quantity:1,tapped:d?.tapped??l.tapped,counters:d?.counters||l.counters,attachments:d?.attachments||l.attachments,temporaryModifiers:d?.temporaryModifiers||l.temporaryModifiers}),quantity:1,stackMembers:[{instanceId:d?.instanceId||e(`member`),tapped:d?.tapped??l.tapped,counters:d?.counters||l.counters,attachments:d?.attachments||l.attachments,temporaryModifiers:d?.temporaryModifiers||l.temporaryModifiers,metadata:d?.metadata||{}}]});a[o]=[...s.slice(0,c),p,m,...s.slice(c+1)],i=!0}),i?R({...t,battlefield:a}):t}function Sr(t){let n=Math.max(1,Number(t.quantity)||1),r=Array.isArray(t.stackMembers)&&t.stackMembers.length?t.stackMembers:[],i=r.length>=n?r.slice(0,n):[...r,...Array.from({length:n-r.length},(n,r)=>({instanceId:e(`member`),tapped:!!t.tapped,attacking:!!t.attacking,blocking:!!t.blocking,summoningSick:!!t.summoningSick,counters:{...t.counters||{}},attachments:Array.isArray(t.attachments)?[...t.attachments]:[],temporaryModifiers:Array.isArray(t.temporaryModifiers)?[...t.temporaryModifiers]:[],metadata:{generatedIndex:r+1,enteredDuringCombat:!!t.enteredDuringCombat,attackingPlayerId:t.attackingPlayerId||``,attackedObjectId:t.attackedObjectId||``,createdByTriggerId:t.createdByTriggerId||``,sourcePermanentId:t.sourcePermanentId||``,combatPhaseCreatedIn:t.combatPhaseCreatedIn||``,tokenTemplateId:t.tokenTemplateId||``,tokenCopyOfId:t.tokenCopyOfId||``}}))];return{...t,quantity:n,stackMembers:i}}function Cr(e,t){return xr(e,t,e=>({...e,tapped:!e.tapped,attacking:!1,blocking:!1}))}function wr(e,t){let n=new Set(e.selectedIds||[]),r=e=>e.map(e=>n.has(e.id)?L({...e,tapped:t,attacking:t?e.attacking:!1,blocking:t?e.blocking:!1}):e);return R({...e,battlefield:{...e.battlefield,player:r(e.battlefield.player),opponent:r(e.battlefield.opponent)}})}function Tr(t,r={}){let i=String(r.mode||`remove`),a=String(r.countMode||`all`),o=Math.max(1,n(r.count,1)),s=r.countById&&typeof r.countById==`object`?r.countById:{},c=new Set(t.selectedIds||[]);if(!c.size)return t;let l=[],u=new Set,d=[],f=Dr(i),p=Or(i),m=e(`chain`),h={...t,battlefield:{...t.battlefield,player:[...t.battlefield.player],opponent:[...t.battlefield.opponent]}};if([`player`,`opponent`].forEach(t=>{let r=[];(h.battlefield[t]||[]).forEach(g=>{if(!c.has(g.id)){r.push(g);return}let _=Math.max(1,Number(g.quantity)||1),v=Math.max(1,n(s[g.id],o)),y=Math.max(1,Math.min(_,a===`all`?_:a===`single`?1:v)),b=_-y;l.push({id:g.id,name:g.name,mode:i,count:y,totalBefore:_,side:t,controller:g.controller,permanent:g});let x=L({...g,id:e(`removed`),quantity:y,stackMembers:(g.stackMembers||[]).slice(0,y)});if(h=z(h,{type:p,eventType:f,payload:{permanent:x,instances:y,cause:i,controller:x.controller},permanent:x,instances:y,cause:i,chainId:m}),b<=0){u.add(g.id);return}let S=L({...g,quantity:b,stackMembers:(g.stackMembers||[]).slice(y)});r.push(S),d.push(S.id)}),h.battlefield[t]=r}),!l.length)return t;let g=e=>L({...e,attachments:(e.attachments||[]).filter(e=>!u.has(e)),relationships:{...e.relationships||{},attachedIds:(e.relationships?.attachedIds||[]).filter(e=>!u.has(e)),attachedToId:u.has(e.relationships?.attachedToId)?``:e.relationships?.attachedToId},attachedToId:u.has(e.attachedToId)?``:e.attachedToId}),_=Er(h,l,i);return R({..._,selectedIds:d,battlefield:{..._.battlefield,player:_.battlefield.player.map(g),opponent:_.battlefield.opponent.map(g)},effectLog:[{id:e(`effect`),at:Date.now(),sourceName:`Permanent Controls`,text:`${i} ${l.map(e=>`${e.name} x${e.count}`).join(`, `)}`,summary:`${i} ${l.reduce((e,t)=>e+t.count,0)} permanent instance(s)`,payload:{mode:i,countMode:a,count:o,removed:l},status:`resolved`},...t.effectLog||[]]})}function Er(e,t=[],n=`remove`){if(!e.simulation?.enabled||!t.length)return e;let r={...e.simulation.opponents||{}},i=!1;return t.forEach(e=>{if(e.side!==`opponent`||!e.controller||!r[e.controller])return;let t=r[e.controller],a={name:e.permanent?.name||e.name,typeLine:e.permanent?.typeLine||`Permanent`,manaValue:e.permanent?.manaValue||0,cardId:e.permanent?.cardId||``,role:e.permanent?.role||``},o={...t.zones||{},graveyard:[...t.zones?.graveyard||[]],exile:[...t.zones?.exile||[]],command:[...t.zones?.command||[]],battlefield:[...t.zones?.battlefield||[]]};if(e.permanent?.isCommander||t.commander?.card?.name===a.name){o.command=[t.commander.card],r[e.controller]={...t,zones:o,commander:{...t.commander,zone:`command`,tax:Number(t.commander?.tax||0)+2},updatedAt:Date.now()},i=!0;return}String(n||``).toLowerCase()===`exile`?o.exile.push(a):o.graveyard.push(a),r[e.controller]={...t,zones:o,updatedAt:Date.now()},i=!0}),i?{...e,simulation:{...e.simulation,opponents:r,updatedAt:Date.now()}}:e}function Dr(e=`remove`){let t=String(e||`remove`).toLowerCase();return t===`destroy`?`DESTROY`:t===`exile`?`EXILE`:t===`sacrifice`?`SACRIFICE`:`LEAVE_BATTLEFIELD`}function Or(e=`remove`){let t=String(e||`remove`).toLowerCase();return t===`destroy`||t===`sacrifice`?`permanent-died`:`permanent-left`}function kr(e,t){let n=e.selectedIds.includes(t);return{...e,selectedIds:n?e.selectedIds.filter(e=>e!==t):[...e.selectedIds,t]}}function Ar(e,t,n=1){let r=`player`,i=[...e.battlefield[r]],a=i.findIndex(e=>e.id===t);if(a<0)return e;let o=Math.max(0,Math.min(i.length-1,a+(Number(n)>=0?1:-1)));if(o===a)return e;let[s]=i.splice(a,1);return i.splice(o,0,s),{...e,battlefield:{...e.battlefield,[r]:i}}}function jr(t,n,r){let i=(t.pendingEffects||[]).find(e=>e.id===n),a=String(r||`pending`).toLowerCase(),o=a===`resolved`?`resolved`:a===`skipped`?`skipped`:a===`ignored`?`ignored`:a;return{...t,pendingEffects:t.pendingEffects.map(e=>e.id===n?{...e,status:a,updatedAt:Date.now()}:e),effectLog:i?[{id:e(`effect`),at:Date.now(),sourceName:i.sourceName||`Manual Effect`,summary:`Manual effect ${o}: ${i.summary||i.effect?.summary||i.effect?.action||`effect`}`,status:a},...t.effectLog||[]].slice(0,80):t.effectLog}}function Mr(t,n=[]){let r=Array.isArray(n)?n.map(e=>({key:String(e.key||``),text:String(e.text||``).trim(),source:String(e.source||`helper`)})).filter(e=>e.key&&e.text).slice(0,8):[];return{...t,helper:{...t.helper||{},reminderRequested:!0,reminderRequestedTurn:t.turn,reminderQueue:r},effectLog:[{id:e(`effect`),at:Date.now(),sourceName:`Helper Sprite`,summary:`Remind me armed for next upkeep${r.length?` (${r.length} message${r.length===1?``:`s`})`:``}.`,status:`queued`},...t.effectLog||[]].slice(0,80)}}function Nr(e,t=``){if(!t)return e;let n=e.helper||{},r=(n.replayQueue||[]).filter(e=>e.key!==t),i=[...new Set([...n.dismissedKeys||[],t])].slice(-80);return{...e,helper:{...n,replayQueue:r,dismissedKeys:i}}}function Pr(e,t=``){if(!t)return e;let n=e.helper||{},r=[...new Set([...n.deliveredKeys||[],t])].slice(-120);return{...e,helper:{...n,deliveredKeys:r,lastKey:t,lastShownAt:Date.now()}}}function Fr(e){let t=(e.triggerQueue||[]).map(t=>t.status===`delayed`&&Number(t.delayedUntilTurn)<=e.turn&&Number(t.delayedUntilPhase)<=e.phaseIndex?{...t,status:`pending`,delayedUntilTurn:null,delayedUntilPhase:null}:t);return{...e,triggerQueue:t}}function Ir(e,t,n){let r=Lr(t,n);if(!r)return e;let i=Lt(e,r,{actionType:n,phase:f[e.phaseIndex],turn:e.turn,permanent:t.card||t.permanent||null,targetIds:t.targetIds||[],amount:t.amount},{sourceId:t.sourceId||t.id||``,playerId:t.playerId||`local-player`});return new Set([`ADD_PERMANENT`,`ADD_CUSTOM_TOKEN`,`CAST_SPELL`,`ADVANCE_PHASE`,`DECLARE_ATTACKERS`]).has(n)?{...i,eventQueue:[]}:Rt(i,(e,t)=>z(zt(e,t),{type:Rr(t.eventType),eventType:t.eventType,phase:t.payload?.phase,payload:t.payload||{},permanent:t.payload?.permanent||null}))}function Lr(e,t){return t===`REMOVE_SELECTED`?``:Bt(t)}function Rr(e){return{ENTER_BATTLEFIELD:`permanent-entered`,LAND_ENTERED_BATTLEFIELD:`land-entered-battlefield`,LANDFALL_CHECK:`landfall-check`,LEAVE_BATTLEFIELD:`permanent-left`,DESTROY:`permanent-died`,EXILE:`permanent-left`,SACRIFICE:`permanent-died`,COUNTER_ADDED:`counter-added`,TOKEN_CREATED:`permanent-entered`,PHASE_CHANGED:`phase-changed`,TURN_CHANGED:`turn-changed`,LIFE_CHANGED:`life-changed`,COMMANDER_DAMAGE_CHANGED:`commander-damage-changed`,SPELL_CAST:`spell-cast`,ABILITY_ACTIVATED:`ability-activated`,ATTACK_DECLARED:`attackers-declared`,ATTACK_TRIGGER_CHECK:`attack-trigger-check`,BLOCK_DECLARED:`blockers-declared`}[e]||`state-changed`}function q(e,t){let{runtime:n,...r}=t||{};return{...e,activeSession:{...r,updatedAt:Date.now()}}}function zr(e,t={}){return{...e,runtime:{adhdAutomation:!!(t.adhdAutomation??t.adhdMode?.enabled??!0),confirmAmbiguousEffects:!!(t.confirmAmbiguousEffects??!0),adhdModeEnabled:!!t.adhdMode?.enabled,debugRules:!!t.developer?.rulesDebug}}}function Br(t,n){if(n.actionType===`SAVE_TICK`||n.type===`SAVE_TICK`)return t;let r=n.actionType||n.type||`UNKNOWN`,i={actionId:n.actionId||e(`action`),timestamp:n.timestamp||Date.now(),playerId:n.playerId||`local-player`,sourceId:n.sourceId||n.id||``,targetIds:Array.isArray(n.targetIds)?n.targetIds:[],actionType:r,payload:n.payload||{},resultingStateReference:n.resultingStateReference||`${t.activeSession.id}:${t.activeSession.updatedAt}`,replayable:n.replayable!==!1,undoable:n.undoable!==!1,snapshot:qr(t.activeSession)};return{...t,activeSession:{...t.activeSession,history:[{id:i.actionId,at:i.timestamp,type:r,summary:n.summary||r},...t.activeSession.history].slice(0,250),actionHistory:[i,...t.activeSession.actionHistory||[]].slice(0,600)}}}function Vr(e,t){let n=t.actionType||t.type||`UNKNOWN`;return{...e,activeSession:{...e.activeSession,undoStack:[{reason:n,snapshot:Kr(e.activeSession)},...e.activeSession.undoStack].slice(0,50),redoStack:[]}}}function Hr(e){let[t,...n]=e.activeSession.undoStack;return t?{...e,activeSession:{...t.snapshot,undoStack:n,redoStack:[{reason:`UNDO`,snapshot:Kr(e.activeSession)},...e.activeSession.redoStack||[]].slice(0,50)}}:e}function Ur(e){let[t,...n]=e.activeSession.redoStack||[];return t?{...e,activeSession:{...t.snapshot,redoStack:n,undoStack:[{reason:`REDO`,snapshot:Kr(e.activeSession)},...e.activeSession.undoStack||[]].slice(0,50)}}:e}function Wr(e,t){let n=e.activeSession.actionHistory||[],r=n.find(e=>e.actionId===t);return r?.snapshot?{...e,activeSession:{...qr(r.snapshot),replay:{...r.snapshot.replay||{},active:!0,cursor:n.findIndex(e=>e.actionId===t),running:!1}}}:e}function Gr(e){return[...e.battlefield?.player||[],...e.battlefield?.opponent||[]]}function Kr(e){let t=i(e);return t.undoStack=[],t.redoStack=[],t.actionHistory=[],t.history=[],t.eventQueue=[],t.eventHistory=[],t.runtime=void 0,t}function qr(e){let t=Kr(e);return t.effectLog=(t.effectLog||[]).slice(0,120),t.pendingEffects=(t.pendingEffects||[]).slice(0,60),t.triggerQueue=(t.triggerQueue||[]).slice(0,180),t.helper&&={...t.helper,reminderQueue:(t.helper.reminderQueue||[]).slice(0,12),replayQueue:(t.helper.replayQueue||[]).slice(0,12),dismissedKeys:(t.helper.dismissedKeys||[]).slice(-120),deliveredKeys:(t.helper.deliveredKeys||[]).slice(-180)},t.replay={...t.replay||{},active:!1,cursor:-1,running:!1},t}var Jr=`boardstate`,Yr=`profiles`,Xr=`protected-profile`,Zr=`auth-meta`,Qr=`boardstate-profile`,$r=`boardstate-protected-profile`,ei=`boardstate-auth-meta`,ti=`boardstate-guest-session`,ni=[`boardstate-hybrid-profile`];function ri(){return`indexedDB`in globalThis?new Promise(e=>{let t=indexedDB.open(Jr,1);t.onupgradeneeded=()=>{t.result.createObjectStore(Yr)},t.onsuccess=()=>e(t.result),t.onerror=()=>e(null)}):Promise.resolve(null)}async function ii(){return J(wi(await ui()))}async function ai(e,t=h()){let n=await mi(e),r=J({...t,localAuth:{mode:`protected`,locked:!1,hasPassword:!0}});return await pi(Xr,r),await pi(Zr,n),Ei(r),Di(n),r}async function oi(e){let t=await di();if(!t||!await hi(e,t))throw Error(`Invalid password`);return J({...await fi(Xr)||Si()||xi()||h(),localAuth:{mode:`protected`,locked:!1,hasPassword:!0}})}async function si(){try{sessionStorage.removeItem(ti)}catch{}return J(wi(await ui()))}async function ci(){return J(wi(await ui()))}async function li(e){let t=J(e);if(t.localAuth?.mode===`protected`&&!t.localAuth?.locked)return await pi(Xr,t),Ei(t),t;try{sessionStorage.setItem(ti,JSON.stringify(Ti(t)))}catch{}return t}async function ui(){return!!await di()}async function di(){return await fi(Zr)||Ci()}async function fi(e){let t=await ri();if(!t)return null;let n=await new Promise(n=>{let r=t.transaction(Yr,`readonly`).objectStore(Yr).get(e);r.onsuccess=()=>n(r.result||null),r.onerror=()=>n(null)});return t.close(),n}async function pi(e,t){let n=await ri();return n?(await new Promise((r,i)=>{let a=n.transaction(Yr,`readwrite`);a.objectStore(Yr).put(t,e),a.oncomplete=()=>r(),a.onerror=()=>i(a.error)}),n.close(),!0):!1}async function mi(e){let t=crypto.getRandomValues(new Uint8Array(16)),n=await gi(e,t);return{version:1,algorithm:`SHA-256`,salt:_i(t),hash:n,createdAt:Date.now()}}async function hi(e,t){return await gi(e,vi(t.salt||``))===t.hash}async function gi(e,t){let n=new TextEncoder().encode(`${_i(t)}:${e}`),r=await crypto.subtle.digest(`SHA-256`,n);return _i(new Uint8Array(r))}function _i(e){return btoa(String.fromCharCode(...e))}function vi(e){try{return Uint8Array.from(atob(e),e=>e.charCodeAt(0))}catch{return new Uint8Array}}function yi(e){return JSON.stringify({exportedAt:new Date().toISOString(),app:`BoardState`,profile:e},null,2)}function bi(e){let t=JSON.parse(e);return J(t.profile||t)}function xi(){try{let e=localStorage.getItem(Qr)||ni.map(e=>localStorage.getItem(e)).find(Boolean);return e?J(JSON.parse(e)):null}catch{return null}}function Si(){try{let e=localStorage.getItem($r);return e?J(JSON.parse(e)):null}catch{return null}}function Ci(){try{let e=localStorage.getItem(ei);return e?JSON.parse(e):null}catch{return null}}function J(e){let t=h(),n={...t.activeSession.manaPool,...e.activeSession?.manaPool||{}};return p.forEach(e=>{n[e]=Number.isFinite(Number(n[e]))?Math.max(0,Math.floor(Number(n[e]))):0}),{...t,...e,player:{...t.player,...e.player||{}},settings:{...t.settings,...e.settings||{},pagePanels:{...t.settings.pagePanels,...e.settings?.pagePanels||{}},multiplayer:{...t.settings.multiplayer,...e.settings?.multiplayer||{}},battlefield:{...t.settings.battlefield,...e.settings?.battlefield||{}},appearance:{...t.settings.appearance,...e.settings?.appearance||{}},navigation:{...t.settings.navigation,...e.settings?.navigation||{}},gestures:{...t.settings.gestures,...e.settings?.gestures||{}},adhdMode:{...t.settings.adhdMode,...e.settings?.adhdMode||{}},helperSprite:{...t.settings.helperSprite,...e.settings?.helperSprite||{}},recentCounterTypes:e.settings?.recentCounterTypes||t.settings.recentCounterTypes||[]},localAuth:{...t.localAuth,...e.localAuth||{}},activeSession:{...t.activeSession,...e.activeSession||{},manaPool:n,battlefield:{...t.activeSession.battlefield,...e.activeSession?.battlefield||{}},fsm:{...t.activeSession.fsm,...e.activeSession?.fsm||{}},helper:{...t.activeSession.helper,...e.activeSession?.helper||{}},simulation:{...t.activeSession.simulation,...e.activeSession?.simulation||{}},gameTracking:{...t.activeSession.gameTracking,...e.activeSession?.gameTracking||{}},history:e.activeSession?.history||t.activeSession.history,actionHistory:e.activeSession?.actionHistory||t.activeSession.actionHistory,eventHistory:e.activeSession?.eventHistory||t.activeSession.eventHistory,eventQueue:e.activeSession?.eventQueue||t.activeSession.eventQueue,undoStack:e.activeSession?.undoStack||t.activeSession.undoStack,redoStack:e.activeSession?.redoStack||t.activeSession.redoStack},statsSync:{...t.statsSync,...e.statsSync||{}},simulationMemory:{...t.simulationMemory,...e.simulationMemory||{}}}}function wi(e){let t=null;try{t=JSON.parse(sessionStorage.getItem(ti)||`null`)}catch{t=null}return{...t||h(),archives:[],commanders:{},leaderboards:h().leaderboards,activeSession:t?.activeSession||h().activeSession,localAuth:{mode:`guest`,locked:!1,hasPassword:e}}}function Ti(e){return{...e,archives:[],commanders:{},localAuth:{mode:`guest`,locked:!1,hasPassword:!!e.localAuth?.hasPassword}}}function Ei(e){try{localStorage.setItem($r,JSON.stringify(e))}catch{}}function Di(e){try{localStorage.setItem(ei,JSON.stringify(e))}catch{}}var Oi=`boardstate-sync`;function ki({onRemoteAction:e,onPresence:t}={}){let n=`offline`,r=`boardstate-room`,i=`ws://localhost:8787`,a=`player`,o=null,s=null,c=null,l=new Set,u=`peer-${Math.random().toString(36).slice(2,8)}`;function d(e=`offline`,o={}){if(p(),n=e,r=o.roomId||`boardstate-room`,i=o.wsUrl||`ws://localhost:8787`,a=o.role||`player`,n===`local`&&m(),n===`wifi`&&h(),n===`simulated`){let e=Array.isArray(o.simulatedPlayers)?o.simulatedPlayers:[];t?.([{id:`local-player`,name:o.localName||`Player`,role:a},...e.map(e=>({id:e.id,name:e.name,role:e.role||`player`}))])}}function f(e,t){if(!e?.actionId||!e?.replayable||a===`spectator`||l.has(e.actionId))return;l.add(e.actionId);let n={type:`action`,roomId:r,peerId:u,action:Ai(e),publicState:ji(t)};o&&o.postMessage(n),s?.readyState===WebSocket.OPEN&&s.send(JSON.stringify(n))}function p(){o&&=(o.close(),null),s&&=(s.onopen=null,s.onclose=null,s.onmessage=null,s.close(),null),clearTimeout(c),c=null}function m(){o=new BroadcastChannel(`${Oi}:${r}`),o.onmessage=({data:e})=>_(e),t?.([{id:u,name:`Local Peer`,role:a}])}function h(){try{s=new WebSocket(i)}catch{g();return}s.onopen=()=>{s.send(JSON.stringify({type:`join`,roomId:r,peerId:u,role:a}))},s.onmessage=({data:e})=>{try{_(JSON.parse(e))}catch{}},s.onclose=()=>{g()}}function g(){clearTimeout(c),c=setTimeout(()=>{n===`wifi`&&h()},1200)}function _(n){if(!(!n||n.peerId===u||n.roomId!==r)){if(n.type===`presence`&&Array.isArray(n.peers)){t?.(n.peers);return}if(n.type===`action`&&n.action?.actionId){if(l.has(n.action.actionId))return;l.add(n.action.actionId),e?.(n.action,n.publicState||null)}}}return{configure:d,sendAction:f,teardown:p}}function Ai(e){return{...e,payload:e.payload||{},targetIds:Array.isArray(e.targetIds)?e.targetIds:[]}}function ji(e){let t=e.activeSession;return{player:{name:e.player?.name||`Player`},life:t.life,turn:t.turn,phaseIndex:t.phaseIndex,battlefield:{player:Mi(t.battlefield.player),opponent:Mi(t.battlefield.opponent)},triggerQueueSize:(t.triggerQueue||[]).filter(e=>e.status===`pending`).length,updatedAt:Date.now()}}function Mi(e=[]){return e.map(e=>({id:e.id,name:e.name,typeLine:e.typeLine,tapped:e.tapped,quantity:e.quantity,counters:e.counters,currentPower:e.currentPower,currentToughness:e.currentToughness,isToken:e.isToken,isCommander:e.isCommander}))}function Ni(){let e=h(),t=new Set,n=null,r=!1,i=ki({onRemoteAction:async(t,n)=>{let r={...t,sourceId:t.sourceId||t.playerId||`remote`,summary:t.summary||`Remote ${t.actionType||t.type}`};e=Tn(e,Ut(r,e)),n&&(e=Pi(e,n)),a(),await li(e)},onPresence:t=>{e={...e,settings:{...e.settings||{},multiplayer:{...e.settings?.multiplayer||{},connectedPlayers:t}}},a()}});function a(){t.forEach(t=>t(e))}function o(){clearTimeout(n),n=null;let t=e.activeSession?.simulation;if(e.settings?.multiplayer?.mode!==`simulated`||!t?.enabled||t.status!==`running`)return;let i=an(t.speed||`normal`);n=setTimeout(async()=>{if(r)return;r=!0;let t=e.activeSession?.simulation?.speed||`normal`;try{await c.dispatch({type:`SIMULATION_TICK`,sourceId:`simulation-engine`,playerId:e.activeSession?.simulation?.currentPlayerId||`npc`,internalOnly:!0,remote:!0}),t===`step`&&await c.dispatch({type:`SIMULATION_PAUSE`,sourceId:`simulation-engine`,internalOnly:!0,remote:!0})}finally{r=!1}},i)}function s(){let t=e.settings?.multiplayer||{},n=t.mode===`wifi`?`wifi`:t.mode===`local`?`local`:t.mode===`simulated`?`simulated`:`offline`;i.configure(n,{roomId:t.roomId||`boardstate-room`,wsUrl:t.wsUrl||`ws://localhost:8787`,role:t.role||`player`,localName:e.player?.name||`Player`,simulatedPlayers:Object.values(e.activeSession?.simulation?.opponents||{}).map(e=>({id:e.id,name:e.name,role:`player`}))})}let c={async init(){e=await ii(),s(),a(),o()},getState(){return e},async dispatch(t){let n=Ut(t,e);Fi(e,n)||(e=Tn(e,n),a(),await li(e),!t?.remote&&!t?.internalOnly&&i.sendAction(n,e),(t?.type===`SET_MULTIPLAYER_MODE`||t?.actionType===`SET_MULTIPLAYER_MODE`||t?.type===`SET_SETTING`)&&s(),o())},async createPassword(t){e=await ai(t,e),s(),a(),await li(e),o()},async login(t){e=await oi(t),s(),a(),o()},async continueGuest(){e=await si(),s(),a(),o()},async lockProfile(){e=await ci(),s(),a(),o()},subscribe(e){return t.add(e),()=>t.delete(e)}};return c}function Pi(e,t){let n=e.settings?.multiplayer?.connectedPlayers||[],r={id:t.player?.name||`remote-peer`,name:t.player?.name||`Remote Player`,authority:`peer`,publicBoardSnapshot:t.battlefield?.player||[],life:t.life,turn:t.turn,phaseIndex:t.phaseIndex,spectator:e.settings?.multiplayer?.spectatorMode||!1},i=[...n.filter(e=>e.id!==r.id),r];return{...e,settings:{...e.settings||{},multiplayer:{...e.settings?.multiplayer||{},connectedPlayers:i}}}}function Fi(e,t){let n=e.settings?.multiplayer||{};return!n.spectatorMode&&n.role!==`spectator`?!1:!new Set([`SET_MULTIPLAYER_MODE`,`SET_SETTING`,`START_SIMULATION`,`SIMULATION_PAUSE`,`SIMULATION_RESUME`,`SIMULATION_STOP`,`SIMULATION_PASS_TURN`,`SIMULATION_SET_SPEED`,`UNDO`,`REDO`,`TRIGGER_QUEUE_RESOLVE`,`TRIGGER_QUEUE_SKIP`,`TRIGGER_QUEUE_DELAY`]).has(t.actionType)}var Ii=`https://api.scryfall.com/cards/search`,Li=`https://api.scryfall.com/cards`,Ri=`boardstate-scryfall-search-cache`,zi=`boardstate-scryfall-card-cache`,Bi=1e3*60*30,Vi=new Map,Hi=new Map,Ui=new Map;async function Wi(e,t=[],n={}){let r=String(e||``).trim(),i=t.filter(e=>e.name.toLowerCase().includes(r.toLowerCase())).map(e=>({...e,source:`commander-deck`}));if(!r)return i;let a=Yi(r);if(a)return Ji([...i,...a]);if(!navigator.onLine)return Ji([...i,...Zi(r)]);let o=r.toLowerCase();if(Ui.has(o)){let e=await Ui.get(o);return Ji([...i,...e])}let s=new URLSearchParams({q:r,unique:`cards`,order:`name`,include_extras:`true`}),c=fetch(`${Ii}?${s.toString()}`,{signal:n.signal}).then(async e=>{if(!e.ok)return[];let t=((await e.json()).data||[]).map(qi);return Xi(r,t),t}).catch(()=>[]).finally(()=>{Ui.delete(o)});Ui.set(o,c);let l=await c;return Ji([...i,...l])}async function Gi(e,t=!0){if(!e)return null;let n=Qi(e);if(n)return n;if(!navigator.onLine)return ea(e);let r=await fetch(`${Li}/${encodeURIComponent(e)}`);if(!r.ok)return null;let i=await r.json(),a={...qi(i),rulingsUri:i.rulings_uri||``,allParts:(i.all_parts||[]).map(e=>({id:e.id,name:e.name,component:e.component,typeLine:e.type_line||``,uri:e.uri||``})),tokenReferences:(i.all_parts||[]).filter(e=>e.component===`token`).map(e=>({id:e.id,name:e.name})),prices:i.prices||{},legalityCommander:i.legalities?.commander||`not_legal`};return t&&a.rulingsUri&&(a.rulings=await Ki(a.rulingsUri)),$i(e,a),a}async function Ki(e){if(!e||!navigator.onLine)return[];try{let t=await fetch(e);return t.ok?((await t.json()).data||[]).slice(0,10).map(e=>({source:e.source,publishedAt:e.published_at,comment:e.comment})):[]}catch{return[]}}function qi(e){let t=Array.isArray(e.card_faces)?e.card_faces[0]:null,n=t?.type_line||e.type_line||``;return{cardId:e.id,name:t?.name||e.name,manaCost:t?.mana_cost||e.mana_cost||``,typeLine:n,oracleText:t?.oracle_text||e.oracle_text||``,imageUrl:e.image_uris?.normal||t?.image_uris?.normal||``,imageSmall:e.image_uris?.small||t?.image_uris?.small||``,legalities:e.legalities||{},colorIdentity:e.color_identity||[],colors:t?.colors||e.colors||[],power:Number(t?.power??e.power)||0,toughness:Number(t?.toughness??e.toughness)||0,loyalty:Number(t?.loyalty??e.loyalty)||0,isToken:n.includes(`Token`)||e.layout===`token`,rulingsUri:e.rulings_uri||``,setCode:e.set,collectorNumber:e.collector_number,scryfallUri:e.scryfall_uri}}function Ji(e){let t=new Set;return e.filter(e=>{let n=e.cardId||e.name;return t.has(n)?!1:(t.add(n),!0)})}function Yi(e){let t=Vi.get(e.toLowerCase());return!t||Date.now()-t.cachedAt>Bi?null:t.data}function Xi(e,t){let n=e.toLowerCase(),r={cachedAt:Date.now(),data:t};Vi.set(n,r),ta(Ri,n,r)}function Zi(e){let t=e.toLowerCase(),n=na(Ri,t);return!n||Date.now()-n.cachedAt>Bi*2?[]:(Vi.set(t,n),n.data||[])}function Qi(e){let t=Hi.get(e);return!t||Date.now()-t.cachedAt>Bi*8?null:t.data}function $i(e,t){let n={cachedAt:Date.now(),data:t};Hi.set(e,n),ta(zi,e,n)}function ea(e){let t=na(zi,e);return t?(Hi.set(e,t),t.data||null):null}function ta(e,t,n){try{let r=JSON.parse(localStorage.getItem(e)||`{}`);r[t]=n,localStorage.setItem(e,JSON.stringify(r))}catch{}}function na(e,t){try{return JSON.parse(localStorage.getItem(e)||`{}`)[t]||null}catch{return null}}function ra(e){let t=e.activeSession,n=[],r=t.battlefield.player||[],i=r.filter(e=>(t.selectedIds||[]).includes(e.id)),a=r.filter(e=>e.isToken&&(e.quantity||1)>1);a.length&&n.push({id:`stack-tokens`,label:`Maintain token stacks`,detail:`${a.length} stack(s) can stay compressed for clarity.`,type:`stack`,confidence:.82});let o=i.find(e=>(e.tokenDefinitions||[]).length||(e.parsedEffects||[]).some(e=>e.action===`create-token`));if(o){let e=o.tokenDefinitions?.[0]||{name:`Generic Token`,typeLine:`Token Creature`,power:1,toughness:1};n.push({id:`predict-token-${o.id}`,label:`Predictive token action`,detail:`Add ${e.name} from ${o.name}.`,type:`token`,confidence:.67,apply:{actionType:`ADD_CUSTOM_TOKEN`,payload:{name:e.name||`Generic Token`,tokenType:e.typeLine||`Creature`,power:Number(e.power||e.basePower||1),toughness:Number(e.toughness||e.baseToughness||1),quantity:1,tapped:!1}}})}if(i.some(e=>e.isAura||e.isEquipment)){let e=i.find(e=>e.isAura||e.isEquipment),r=T(t,`all-creatures`,e).filter(t=>t.controller===e.controller);n.push({id:`legal-attachments`,label:`Suggest legal attachment targets`,detail:`${r.length} compatible creature target(s) for ${e.name}.`,type:`target`,confidence:.76})}if((t.triggerQueue||[]).some(e=>e.status===`pending`)){let e=(t.triggerQueue||[]).filter(e=>e.status===`pending`).length;n.push({id:`resolve-pending-triggers`,label:`Resolve trigger queue`,detail:`${e} pending trigger(s) available to resolve now.`,type:`trigger`,confidence:.9})}let s=r.filter(e=>e.isCreature).sort((e,t)=>(t.currentPower||0)+(t.currentToughness||0)-((e.currentPower||0)+(e.currentToughness||0)))[0];s&&n.push({id:`counter-placement`,label:`Counter placement`,detail:`${s.name} is currently the strongest counter target.`,type:`counter`,confidence:.71});let c=(e.settings?.multiplayer?.connectedPlayers||[]).filter(e=>e.id!==`local-player`);return c.length&&n.push({id:`commander-damage-target`,label:`Commander damage targets`,detail:`${c.length} opponent profile(s) available for commander damage tracking.`,type:`combat`,confidence:.73}),n.slice(0,8)}var ia=`(orientation: portrait) and (max-width: 1024px)`,aa=72,oa=1.35,sa=420,ca=110,la=260,ua=42,da=46,fa=.34,pa={kind:`delta`,value:1,scopes:{life:!0,poison:!1,energy:!1,experience:!1,tickets:!1,commander:!1}},ma={tapped:{glyph:`T`,label:`Tapped`},summoningSickness:{glyph:`S`,label:`Summoning sickness`},flying:{glyph:`F`,label:`Flying`},trample:{glyph:`Tr`,label:`Trample`},vigilance:{glyph:`V`,label:`Vigilance`},menace:{glyph:`Me`,label:`Menace`},deathtouch:{glyph:`D`,label:`Deathtouch`},lifelink:{glyph:`L`,label:`Lifelink`},ward:{glyph:`W`,label:`Ward`},counters:{glyph:`C`,label:`Counters present`},commander:{glyph:`Cmd`,label:`Commander`},token:{glyph:`Tok`,label:`Token`},monarch:{glyph:`Mon`,label:`Monarch`},initiative:{glyph:`Init`,label:`Initiative`},attacking:{glyph:`Atk`,label:`Attacking`},blocking:{glyph:`Blk`,label:`Blocking`},modified:{glyph:`Mod`,label:`Modified`},triggered:{glyph:`Trig`,label:`Triggered ability source`},staticEffect:{glyph:`Sta`,label:`Static effect source`},replacementEffect:{glyph:`Rep`,label:`Replacement effect source`},unresolvedTrigger:{glyph:`!`,label:`Unresolved trigger`},adhdReminder:{glyph:`ADHD`,label:`ADHD reminder active`}};function ha(e,t){let n=[`life`,`battlefield`,`profile`,`archive`,`decks`,`leaderboards`],r=n.includes(location.hash.replace(`#`,``))?location.hash.replace(`#`,``):`life`,i=[],a=``,o=``,s=!1,c=null,l=0,u=null,d=!1,f={start:null,end:null,direction:`none`},p=0,m=!1,h=!1,g=`individual`,_=null,v=!1,y=!1,b=``,x=!1,S=``,C=!1,w=!1,ee=!1,te=!1,ne=new Set([`alpha`]),re=`normal`,T=0,ie=null,ae=``,E=``,oe={x:18,y:520},D=null,O=null,se=new Set,ce=new Map,k=null,A=null,le=null,ue=!1,de=Do(pa),j=Do(pa),fe=!1,pe=0,M=null,me=null,N=new Map;t.subscribe(P),P(t.getState());function P(t){let n=Le(),c=ze(e),l=Fe(e),u=To(t),d=Eo(t.activeSession,ae),f=yo(t,r,{activeToolPanel:b,toolMenuOpen:v,floatingManaOpen:y,utilityDockOpen:x,activeUtilityPanel:S,quickPanelOpen:E,optionsOpen:m,statsOpen:h});u.includes(r)||(r=r===`profile`?`profile`:u[0]||`life`);let p=Aa(t);p.length?T>=p.length&&(T=0):T=0,Array.isArray(t.settings?.multiplayer?.selectedSimulatedOpponents)&&t.settings.multiplayer.selectedSimulatedOpponents.length&&(ne=new Set(t.settings.multiplayer.selectedSimulatedOpponents)),t.settings?.multiplayer?.simulatedSpeed&&(re=t.settings.multiplayer.simulatedSpeed),M=Te(t,r),document.body.dataset.composition=t.settings?.appearance?.compositionMode||`auto`,document.body.dataset.page=r,document.body.dataset.uiLayer=f.current,e.innerHTML=ga(t,r,i,a,{optionsOpen:m,statsOpen:h,statsMode:g,toolMenuOpen:v,floatingManaOpen:y,activeToolPanel:b,toolContext:d,utilityDockOpen:x,activeUtilityPanel:S,quickPanelOpen:E,toolBadgePosition:oe,modifierPanelOpen:ue,trackerModifier:de,pendingTrackerModifier:j,visiblePages:u,expandedStackIds:[...se],uiLayerState:f,searchLoading:s,searchQuery:o,combatResolving:C,phaseAdvancePending:w,helperMessage:M,simulationSetupOpen:ee,simulationLogOpen:te,simulationSelectedOpponents:[...ne],simulationSelectedSpeed:re}),he(e,t),Ne(t),Me(),Ie(e,l),Re(e,n,c)}function he(e,n){e.querySelectorAll(`[data-page]`).forEach(e=>{e.addEventListener(`click`,()=>{ge(e.dataset.page)})}),e.querySelectorAll(`[data-mobile-nav]`).forEach(e=>{e.addEventListener(`click`,()=>{I()&&_e(e.dataset.mobileNav===`next`?1:-1)})}),e.querySelectorAll(`[data-player-counter]`).forEach(e=>{let t=()=>({type:`PLAYER_COUNTER_DELTA`,counter:e.dataset.playerCounter,amount:Number(e.dataset.delta||0)});ye(e,t),be(e,t)}),e.querySelectorAll(`[data-commander-damage]`).forEach(e=>{let t=()=>({type:`COMMANDER_DAMAGE_DELTA`,opponentId:`opponent`,amount:Number(e.dataset.delta||0)});ye(e,t),be(e,t)});let a=e.querySelector(`[data-modifier-badge]`);a&&(a.addEventListener(`pointerdown`,e=>{le={timer:setTimeout(()=>{j=Do(de),ue=!0,Ae(!0),P(t.getState())},sa)},a.setPointerCapture?.(e.pointerId)}),[`pointerup`,`pointercancel`,`pointerleave`].forEach(e=>{a.addEventListener(e,()=>{clearTimeout(le?.timer),e===`pointerup`&&le&&!ue&&ke(),le=null})})),e.querySelectorAll(`[data-modifier-option]`).forEach(e=>{e.addEventListener(`click`,()=>{j={...j,kind:`delta`,value:Number(e.dataset.modifierOption)},P(t.getState())})}),e.querySelectorAll(`[data-modifier-scope]`).forEach(e=>{e.addEventListener(`change`,()=>{j={...j,scopes:{...j.scopes,[e.dataset.modifierScope]:e.checked}},P(t.getState())})}),e.querySelector(`[data-clear-modifier]`)?.addEventListener(`click`,()=>{j=Do(pa),P(t.getState())}),e.querySelector(`[data-confirm-modifier-panel]`)?.addEventListener(`click`,()=>{let n=Number(e.querySelector(`[data-modifier-custom]`)?.value);Number.isFinite(n)&&n!==0&&(j={...j,kind:`delta`,value:n}),de=Do(j),ue=!1,P(t.getState())}),e.querySelector(`[data-cancel-modifier-panel]`)?.addEventListener(`click`,()=>{j=Do(de),ue=!1,P(t.getState())}),e.querySelectorAll(`[data-setting-button]`).forEach(e=>{e.addEventListener(`click`,()=>t.dispatch({type:`SET_SETTING`,path:e.dataset.settingButton,value:Mo(e.dataset.value)}))}),e.querySelector(`[data-add-counter-selected]`)?.addEventListener(`click`,()=>t.dispatch({type:`ADD_COUNTER_SELECTED`,counterType:`+1/+1`,amount:1})),e.querySelector(`[data-sync-public-stats]`)?.addEventListener(`click`,()=>t.dispatch({type:`SYNC_PUBLIC_STATS`})),e.querySelector(`[data-open-floating-mana]`)?.addEventListener(`click`,()=>{let e=!!n.settings?.battlefield?.manaPinned,r=y||e;y=!r,e&&r&&t.dispatch({type:`SET_SETTING`,path:`battlefield.manaPinned`,value:!1}),b=``,v=!1,P(t.getState())}),e.querySelectorAll(`[data-open-tool-panel]`).forEach(e=>{e.addEventListener(`click`,()=>{b=e.dataset.openToolPanel,y=!1,v=!1,P(t.getState())})}),e.querySelectorAll(`[data-close-tool-panel]`).forEach(e=>{e.addEventListener(`click`,()=>{b=``,y=!1,P(t.getState())})}),e.querySelectorAll(`[data-set-tool-context]`).forEach(e=>{e.addEventListener(`click`,n=>{e.matches(`.arena, .opponent-zone`)&&n.target!==e||(ae=e.dataset.setToolContext||``,b=``,v=!1,P(t.getState()))})}),e.querySelectorAll(`[data-open-game-options]`).forEach(e=>e.addEventListener(`click`,()=>{m=!0,b=``,v=!1,P(t.getState())})),e.querySelectorAll(`[data-open-simulation-setup]`).forEach(e=>e.addEventListener(`click`,()=>{ee=!0,P(t.getState())})),e.querySelectorAll(`[data-start-game-tracking]`).forEach(e=>e.addEventListener(`click`,()=>{let e=t.getState().activeSession?.gameTracking||{};t.dispatch({type:e.active?`STOP_GAME_TRACKING`:`START_GAME_TRACKING`})})),e.querySelectorAll(`[data-close-simulation-setup]`).forEach(e=>e.addEventListener(`click`,()=>{ee=!1,P(t.getState())})),e.querySelectorAll(`[data-simulation-log-toggle]`).forEach(e=>e.addEventListener(`click`,()=>{te=!te,P(t.getState())})),e.querySelectorAll(`[data-sim-opponent]`).forEach(e=>e.addEventListener(`change`,()=>{e.checked?ne.add(e.dataset.simOpponent):ne.delete(e.dataset.simOpponent)})),e.querySelectorAll(`[data-sim-speed]`).forEach(e=>e.addEventListener(`change`,()=>{e.checked&&(re=e.dataset.simSpeed||`normal`)})),e.querySelectorAll(`[data-start-simulation]`).forEach(e=>e.addEventListener(`click`,()=>{let e=[...ne].filter(Boolean);t.dispatch({type:`START_SIMULATION`,selectedOpponents:e.length?e:[`alpha`],speed:re||`normal`}),ee=!1})),e.querySelectorAll(`[data-simulation-pause]`).forEach(e=>e.addEventListener(`click`,()=>t.dispatch({type:`SIMULATION_PAUSE`}))),e.querySelectorAll(`[data-simulation-resume]`).forEach(e=>e.addEventListener(`click`,()=>t.dispatch({type:`SIMULATION_RESUME`}))),e.querySelectorAll(`[data-simulation-stop]`).forEach(e=>e.addEventListener(`click`,()=>t.dispatch({type:`SIMULATION_STOP`}))),e.querySelectorAll(`[data-simulation-pass-turn]`).forEach(e=>e.addEventListener(`click`,()=>t.dispatch({type:`SIMULATION_PASS_TURN`}))),e.querySelectorAll(`[data-opponent-nav]`).forEach(e=>e.addEventListener(`click`,()=>{let n=e.dataset.opponentNav===`next`?1:-1,r=Aa(t.getState());r.length&&(T=(T+n+r.length)%r.length,P(t.getState()))})),e.querySelectorAll(`[data-open-opponent-overlay]`).forEach(e=>e.addEventListener(`click`,()=>{P(t.getState())})),e.querySelectorAll(`[data-close-opponent-overlay]`).forEach(e=>e.addEventListener(`click`,()=>{P(t.getState())})),e.querySelectorAll(`[data-opponent-permanent]`).forEach(e=>e.addEventListener(`click`,()=>{let n=e.dataset.opponentPermanent;n&&(ae=`permanent`,t.dispatch({type:`SELECT_PERMANENT`,id:n}))})),e.querySelectorAll(`[data-opponent-swipe]`).forEach(e=>{e.addEventListener(`pointerdown`,e=>{ie={x:e.clientX,y:e.clientY}}),e.addEventListener(`pointerup`,e=>{if(!ie)return;let n=e.clientX-ie.x,r=e.clientY-ie.y;if(ie=null,Math.abs(n)<48||Math.abs(n)<Math.abs(r)*1.2)return;let i=Aa(t.getState());i.length&&(T=(T+(n<0?1:-1)+i.length)%i.length,P(t.getState()))})}),e.querySelector(`[data-tool-menu]`)?.addEventListener(`click`,()=>{v=!v,P(t.getState())});let s=e.querySelector(`[data-tool-badge]`);s&&(s.addEventListener(`pointerdown`,e=>{e.preventDefault(),e.stopPropagation(),s.setPointerCapture?.(e.pointerId),D={startX:e.clientX,startY:e.clientY,originalX:oe.x,originalY:oe.y,moved:!1}}),s.addEventListener(`pointermove`,e=>{if(!D)return;e.preventDefault();let t=e.clientX-D.startX,n=e.clientY-D.startY;D.moved=D.moved||Math.abs(t)>5||Math.abs(n)>5,oe={x:Math.max(8,Math.min(window.innerWidth-82,D.originalX+t)),y:Math.max(8,Math.min(window.innerHeight-82,D.originalY+n))},s.style.left=`${oe.x}px`,s.style.top=`${oe.y}px`}),s.addEventListener(`pointerup`,e=>{if(e.preventDefault(),e.stopPropagation(),D?.moved){D=null;return}D=null,v=!v,P(t.getState())}),[`pointercancel`,`pointerleave`].forEach(e=>s.addEventListener(e,()=>{D=null}))),e.querySelector(`[data-app-shell]`)?.addEventListener(`pointerdown`,e=>{!I()||je(e.target)||(_={x:e.clientX,y:e.clientY})}),e.querySelector(`[data-app-shell]`)?.addEventListener(`pointerup`,e=>{if(!I()||!_||je(e.target)){_=null;return}let t=e.clientX-_.x,n=e.clientY-_.y;_=null,!(Math.abs(t)<aa||Math.abs(t)<Math.abs(n)*oa)&&_e(t<0?1:-1)}),e.querySelectorAll(`[data-game-options]`).forEach(e=>e.addEventListener(`click`,()=>{m=!0,b=``,v=!1,P(t.getState())})),e.querySelectorAll(`[data-close-overlay]`).forEach(e=>{e.addEventListener(`click`,()=>{m=!1,h=!1,P(t.getState())})}),e.querySelector(`[data-profile-form]`)?.addEventListener(`submit`,e=>{e.preventDefault();let n=new FormData(e.currentTarget).get(`profileName`);t.dispatch({type:`SET_PLAYER_NAME`,name:n})}),e.querySelector(`[data-create-password-form]`)?.addEventListener(`submit`,async e=>{e.preventDefault();let n=String(new FormData(e.currentTarget).get(`password`)||``);if(n.length<4){alert(`Use at least 4 characters for local device protection.`);return}await t.createPassword(n)}),e.querySelector(`[data-login-form]`)?.addEventListener(`submit`,async e=>{e.preventDefault();let n=String(new FormData(e.currentTarget).get(`password`)||``);try{await t.login(n)}catch{alert(`Password did not match this local profile.`)}}),e.querySelector(`[data-guest-mode]`)?.addEventListener(`click`,()=>t.continueGuest()),e.querySelector(`[data-lock-profile]`)?.addEventListener(`click`,()=>t.lockProfile()),e.querySelector(`[data-open-profile-page]`)?.addEventListener(`click`,()=>{m=!1,ge(`profile`)}),e.querySelectorAll(`[data-setting-toggle]`).forEach(e=>{e.addEventListener(`change`,()=>t.dispatch({type:`SET_SETTING`,path:e.dataset.settingToggle,value:e.checked}))}),e.querySelector(`[data-helper-remind]`)?.addEventListener(`click`,()=>{let e=Ee(t.getState(),r).slice(0,8).map(e=>({key:e.key,text:e.text,source:e.source}));t.dispatch({type:`HELPER_REMIND_ME`,messages:e})}),e.querySelectorAll(`[data-multiplayer-mode]`).forEach(e=>{e.addEventListener(`click`,()=>t.dispatch({type:`SET_MULTIPLAYER_MODE`,mode:e.dataset.multiplayerMode}))}),e.querySelectorAll(`[data-mp-setting]`).forEach(e=>{e.addEventListener(`change`,()=>t.dispatch({type:`SET_SETTING`,path:e.dataset.mpSetting,value:e.type===`checkbox`?e.checked:e.value}))}),e.querySelector(`[data-open-stats]`)?.addEventListener(`click`,()=>{h=!0,P(t.getState())}),e.querySelectorAll(`[data-stats-mode]`).forEach(e=>{e.addEventListener(`click`,()=>{g=e.dataset.statsMode,P(t.getState())})}),e.querySelector(`[data-token-form]`)?.addEventListener(`submit`,e=>{e.preventDefault();let n=new FormData(e.currentTarget);t.dispatch({type:`ADD_CUSTOM_TOKEN`,name:n.get(`tokenName`),power:n.get(`power`),toughness:n.get(`toughness`),quantity:n.get(`quantity`),tokenType:n.get(`tokenType`),tapped:n.get(`tapped`)===`on`})}),e.querySelectorAll(`[data-selected-action]`).forEach(n=>{n.addEventListener(`click`,()=>{let r=n.dataset.selectedAction;if(r===`inspect`){b=`inspect`,P(t.getState());return}if(r===`tap`||r===`untap`){t.dispatch({type:`SET_SELECTED_TAPPED`,tapped:r===`tap`});return}if(r===`clear`){t.dispatch({type:`CLEAR_SELECTION`});return}if([`destroy`,`exile`,`sacrifice`,`bounce`,`remove`,`remove token`].includes(r)){let i=X(t.getState().activeSession).filter(e=>Number(e.quantity||1)>1);if(!i.length){t.dispatch({type:`REMOVE_SELECTED`,mode:r,countMode:`all`,count:1});return}let a=e.querySelector(`[data-stack-remove-mode]`)?.value||r,o=Oe(i,n.dataset.countMode||`custom`);if(!o)return;t.dispatch({type:`REMOVE_SELECTED`,mode:a,countMode:o.countMode,count:o.count,countById:o.countById});return}t.dispatch({type:`REMOVE_SELECTED`,mode:r})})}),e.querySelectorAll(`[data-stack-remove]`).forEach(n=>{n.addEventListener(`click`,()=>{let r=X(t.getState().activeSession).filter(e=>Number(e.quantity||1)>1);if(!r.length)return;let i=e.querySelector(`[data-stack-remove-mode]`)?.value||`destroy`,a=Oe(r,n.dataset.stackRemove||`custom`);a&&t.dispatch({type:`REMOVE_SELECTED`,mode:i,countMode:a.countMode,count:a.count,countById:a.countById})})}),e.querySelector(`[data-counter-form]`)?.addEventListener(`submit`,e=>{e.preventDefault();let n=new FormData(e.currentTarget);t.dispatch({type:`APPLY_COUNTER_SCOPE`,scope:n.get(`scope`),counterType:n.get(`counterType`),amount:n.get(`quantity`)})}),e.querySelectorAll(`[data-counter-recent]`).forEach(t=>{t.addEventListener(`click`,()=>{let n=e.querySelector(`[data-counter-type-input]`);n&&(n.value=t.dataset.counterRecent,n.focus())})}),e.querySelector(`[data-token-remove-selected]`)?.addEventListener(`click`,()=>{t.dispatch({type:`REMOVE_SELECTED`,mode:`remove token`})}),e.querySelector(`[data-open-life-quick]`)?.addEventListener(`click`,()=>{E=`life`,P(t.getState())}),e.querySelector(`[data-open-commander-quick]`)?.addEventListener(`click`,()=>{E=`commander`,P(t.getState())}),e.querySelectorAll(`[data-player-life-delta]`).forEach(e=>{let t=()=>({type:`LIFE_DELTA`,amount:Number(e.dataset.playerLifeDelta||0)});ye(e,t),be(e,t)}),e.querySelectorAll(`[data-player-counter-delta]`).forEach(e=>{let t=()=>({type:`PLAYER_COUNTER_DELTA`,counter:e.dataset.playerCounterDelta,amount:Number(e.dataset.delta||0)});ye(e,t),be(e,t)}),e.querySelector(`[data-save-player-note]`)?.addEventListener(`click`,()=>{let n=String(e.querySelector(`[data-player-note-input]`)?.value||``).trim();t.dispatch({type:`SET_SETTING`,path:`playerNotes.session`,value:n})}),e.querySelector(`[data-activate-board]`)?.addEventListener(`click`,()=>{t.dispatch({type:`ACTIVATE_BOARD`})}),e.querySelectorAll(`[data-life-delta]`).forEach(e=>{let t=()=>({type:`LIFE_DELTA`,amount:Number(e.dataset.lifeDelta||0)});ye(e,t),be(e,t)}),e.querySelector(`[data-life-set]`)?.addEventListener(`click`,()=>{let e=prompt(`Set life total`,String(n.activeSession.life));e!==null&&F({type:`SET_LIFE`,life:e},!0)}),e.querySelector(`[data-life-reset]`)?.addEventListener(`click`,()=>F({type:`RESET_PLAYER_TRACKERS`},!0)),e.querySelector(`[data-close-quick-panel]`)?.addEventListener(`click`,()=>{E=``,P(t.getState())});let l=e.querySelector(`[data-life-gesture]`);l&&xe(l);let u=e.querySelector(`[data-commander-value]`);u&&Se(u),e.querySelector(`[data-commander-damage-set]`)?.addEventListener(`click`,()=>{let e=n.activeSession.commander.damageByOpponent?.opponent||0,t=prompt(`Set commander damage`,String(e));t!==null&&F({type:`SET_COMMANDER_DAMAGE`,opponentId:`opponent`,value:t},!0)}),e.querySelector(`[data-commander-damage-reset]`)?.addEventListener(`click`,()=>F({type:`SET_COMMANDER_DAMAGE`,opponentId:`opponent`,value:0},!0)),e.querySelector(`[data-undo]`)?.addEventListener(`click`,()=>t.dispatch({type:`UNDO`})),e.querySelector(`[data-redo]`)?.addEventListener(`click`,()=>t.dispatch({type:`REDO`})),e.querySelectorAll(`[data-next-phase]`).forEach(e=>{w&&(e.disabled=!0,e.dataset.phaseLabel=e.textContent||`Next Phase`,e.textContent=`Advancing…`),e.addEventListener(`click`,()=>{ve()})}),e.querySelector(`[data-archive-game]`)?.addEventListener(`click`,()=>t.dispatch({type:`ARCHIVE_GAME`,result:`completed`})),e.querySelector(`[data-cast-commander]`)?.addEventListener(`click`,()=>t.dispatch({type:`CAST_COMMANDER`})),e.querySelectorAll(`[data-mana]`).forEach(e=>{e.addEventListener(`click`,()=>t.dispatch({type:`ADD_MANA`,color:e.dataset.mana,amount:1}))}),e.querySelectorAll(`[data-mana-minus]`).forEach(e=>{e.addEventListener(`click`,()=>t.dispatch({type:`ADD_MANA`,color:e.dataset.manaMinus,amount:-1}))}),e.querySelector(`[data-clear-mana]`)?.addEventListener(`click`,()=>t.dispatch({type:`CLEAR_MANA`})),e.querySelectorAll(`[data-permanent]`).forEach(e=>{e.addEventListener(`click`,r=>{if(n.settings?.gestures?.advanced){r.preventDefault();return}ae=``,t.dispatch({type:`SELECT_PERMANENT`,id:e.dataset.permanent})})}),e.querySelectorAll(`[data-toggle-stack]`).forEach(e=>{e.addEventListener(`click`,()=>{let n=e.dataset.toggleStack;n&&(se.has(n)?se.delete(n):se.add(n),P(t.getState()))})}),e.querySelectorAll(`[data-set-detail-mode]`).forEach(e=>{e.addEventListener(`click`,()=>{t.dispatch({type:`SET_SETTING`,path:`battlefield.detailMode`,value:e.dataset.setDetailMode})})}),e.querySelectorAll(`[data-set-compression-mode]`).forEach(e=>{e.addEventListener(`click`,()=>{t.dispatch({type:`SET_SETTING`,path:`battlefield.compressionMode`,value:e.dataset.setCompressionMode})})}),e.querySelectorAll(`[data-tap]`).forEach(e=>{e.addEventListener(`click`,()=>t.dispatch({type:`TOGGLE_TAPPED`,id:e.dataset.tap}))}),e.querySelectorAll(`[data-counter]`).forEach(e=>{e.addEventListener(`click`,()=>t.dispatch({type:`ADD_COUNTER`,id:e.dataset.counter,counterType:`+1/+1`,amount:1}))}),e.querySelector(`[data-declare-attackers]`)?.addEventListener(`click`,()=>t.dispatch({type:`DECLARE_ATTACKERS`,ids:n.activeSession.selectedIds})),e.querySelector(`[data-resolve-combat]`)?.addEventListener(`click`,()=>{C||(C=!0,P(t.getState()),requestAnimationFrame(()=>{setTimeout(()=>{t.dispatch({type:`RESOLVE_COMBAT`}),C=!1,P(t.getState())},0)}))}),e.querySelector(`[data-token]`)?.addEventListener(`click`,()=>t.dispatch({type:`ADD_PERMANENT`,card:{name:`Soldier Token`,typeLine:`Token Creature - Soldier`,basePower:1,baseToughness:1,isToken:!0,ownedByCommanderDeck:!1}})),e.querySelector(`[data-export]`)?.addEventListener(`click`,()=>Fo(n)),e.querySelector(`[data-import]`)?.addEventListener(`change`,async e=>{let n=e.target.files?.[0];if(!n)return;let r=await n.text();await t.dispatch({type:`IMPORT_PROFILE`,profile:bi(r)})}),e.querySelector(`[data-search-form]`)?.addEventListener(`submit`,async e=>{e.preventDefault();let n=new FormData(e.currentTarget).get(`query`);o=String(n||``),d=!0,await Pe(n,t.getState(),!0)});let O=e.querySelector(`[data-search-query]`);O?.addEventListener(`focus`,()=>{d=Date.now()>=p}),O?.addEventListener(`blur`,()=>{Date.now()>=p&&(d=!1)}),O?.addEventListener(`input`,e=>{let n=e.target.value;o=String(n||``),d=!0,f={start:e.target.selectionStart,end:e.target.selectionEnd,direction:e.target.selectionDirection||`none`},clearTimeout(c),c=setTimeout(()=>{Pe(n,t.getState(),!1)},220)}),e.querySelector(`.search-results`)?.addEventListener(`pointerdown`,e=>{e.stopPropagation(),d=!0,f={start:O?.selectionStart,end:O?.selectionEnd,direction:O?.selectionDirection||`none`}}),e.querySelector(`.search-results`)?.addEventListener(`touchstart`,e=>{e.stopPropagation()}),e.querySelectorAll(`[data-add-result]`).forEach(e=>{e.addEventListener(`click`,()=>{d=!1,p=Date.now()+600,t.dispatch({type:`ADD_PERMANENT`,card:i[Number(e.dataset.addResult)]})})}),e.querySelectorAll(`[data-cast-result]`).forEach(e=>{e.addEventListener(`click`,()=>{d=!1,p=Date.now()+600,t.dispatch({type:`CAST_SPELL`,card:i[Number(e.dataset.castResult)]})})}),e.querySelectorAll(`[data-commander-result]`).forEach(e=>{e.addEventListener(`click`,()=>{d=!1,p=Date.now()+600,t.dispatch({type:`SET_COMMANDER`,card:i[Number(e.dataset.commanderResult)]})})}),e.querySelectorAll(`[data-deck-result]`).forEach(e=>{e.addEventListener(`click`,()=>{d=!1,p=Date.now()+600,t.dispatch({type:`ADD_DECK_CARD`,card:i[Number(e.dataset.deckResult)]})})}),e.querySelectorAll(`[data-inspect-result]`).forEach(e=>{e.addEventListener(`click`,async()=>{let t=i[Number(e.dataset.inspectResult)];if(!t?.cardId)return;let n=await Gi(t.cardId,!0);if(!n)return;let r=(n.rulings||[]).slice(0,3).map(e=>`- ${e.comment}`).join(`
`)||`- none`;alert(`${n.name}\n${n.manaCost} ${n.typeLine}\n\n${n.oracleText||``}\n\nRulings:\n${r}\n\nTokens: ${(n.tokenReferences||[]).map(e=>e.name).join(`, `)||`none`}`)})}),e.querySelectorAll(`[data-pending-effect]`).forEach(e=>{e.addEventListener(`click`,()=>t.dispatch({type:`MARK_PENDING_EFFECT`,id:e.dataset.pendingEffect,status:e.dataset.status}))}),e.querySelectorAll(`[data-trigger-resolve]`).forEach(e=>{e.addEventListener(`click`,()=>t.dispatch({type:`TRIGGER_QUEUE_RESOLVE`,id:e.dataset.triggerResolve}))}),e.querySelectorAll(`[data-trigger-delay]`).forEach(e=>{e.addEventListener(`click`,()=>t.dispatch({type:`TRIGGER_QUEUE_DELAY`,id:e.dataset.triggerDelay}))}),e.querySelectorAll(`[data-trigger-skip]`).forEach(e=>{e.addEventListener(`click`,()=>t.dispatch({type:`TRIGGER_QUEUE_SKIP`,id:e.dataset.triggerSkip}))}),e.querySelectorAll(`[data-trigger-inspect]`).forEach(e=>{e.addEventListener(`click`,()=>{let n=e.dataset.triggerInspect,r=(t.getState().activeSession.triggerQueue||[]).find(e=>e.id===n);r&&alert(`${r.sourceName}\n${r.eventType}\nEffects: ${(r.effectDefinitions||[]).map(e=>e.action||`effect`).join(`, `)}\nModifiers: ${(r.generatedModifiers||[]).map(e=>`L${e.layer}:${e.operation}`).join(` | `)||`none`}`)})}),e.querySelectorAll(`[data-replay-action]`).forEach(e=>{e.addEventListener(`click`,()=>{t.dispatch({type:`REPLAY_TO_ACTION`,replayActionId:e.dataset.replayAction})})}),e.querySelectorAll(`[data-prediction-apply]`).forEach(e=>{e.addEventListener(`click`,()=>{let n=ra(t.getState()).find(t=>t.id===e.dataset.predictionApply);n?.apply?.actionType&&t.dispatch({type:n.apply.actionType,...n.apply.payload||{}})})}),e.querySelector(`[data-helper-dismiss]`)?.addEventListener(`click`,()=>{De(!0)}),e.querySelector(`[data-helper-open]`)?.addEventListener(`click`,()=>{if(M){if(M.source===`trigger-queue`)S=`triggers`,x=!0;else if(M.source===`pending-effects`)b=`inspect`;else if(M.source===`phase`){ve();return}else M.source===`stack-removal`&&(b=`permanents`);P(t.getState())}}),e.querySelector(`[data-toggle-utility-dock]`)?.addEventListener(`click`,()=>{x=!x,x||(S=``),P(t.getState())}),e.querySelectorAll(`[data-open-utility]`).forEach(e=>{e.addEventListener(`click`,()=>{S=e.dataset.openUtility||``,x=!0,v=!1,b=``,P(t.getState())})}),e.querySelectorAll(`[data-close-utility-panel]`).forEach(e=>{e.addEventListener(`click`,()=>{S=``,P(t.getState())})}),e.querySelectorAll(`[data-roll-dice]`).forEach(e=>{e.addEventListener(`click`,()=>{let n=Math.max(2,Number(e.dataset.rollDice)||20),r=Math.floor(Math.random()*n)+1;t.dispatch({type:`SET_SETTING`,path:`utility.lastDice`,value:`d${n}: ${r}`})})}),e.querySelector(`[data-run-calculator]`)?.addEventListener(`click`,()=>{let n=String(e.querySelector(`[data-utility-calculator]`)?.value||``).trim();if(!n)return;let r=n.replace(/[^0-9+\-*/(). ]/g,``);try{let e=Function(`"use strict"; return (${r})`)();t.dispatch({type:`SET_SETTING`,path:`utility.calculator`,value:`${r} = ${e}`})}catch{t.dispatch({type:`SET_SETTING`,path:`utility.calculator`,value:`${r} = error`})}}),e.querySelector(`[data-save-utility-note]`)?.addEventListener(`click`,()=>{let n=String(e.querySelector(`[data-utility-note]`)?.value||``);t.dispatch({type:`SET_SETTING`,path:`playerNotes.dock`,value:n})}),Ce(e,n),e.querySelector(`.floating-mana`)?.addEventListener(`pointerdown`,()=>Ne(t.getState())),we(e,n),document.onkeydown=e=>{e.key===`Escape`&&(b||y||v)&&(b=``,y=!1,v=!1,S=``,P(t.getState()))},document.onpointerdown=e=>{!b&&!y&&!S||e.target.closest(`.floating-tool-panel, .floating-mana, .radial-menu, .tool-badge, .utility-dock, .utility-overlay, button, input, label, textarea, select, [data-permanent-card], [data-permanent], [data-tap], [data-counter]`)||n.settings?.battlefield?.manaPinned||(b=``,y=!1,S=``,P(t.getState()))}}function ge(e){if(!n.includes(e))return;let i=To(t.getState());e!==`profile`&&!i.includes(e)||(r=e,history.replaceState(null,``,`#${r}`),m=!1,h=!1,E=``,ae=``,v=!1,b=``,x=!1,S=``,P(t.getState()))}function _e(e){let n=To(t.getState()),i=Math.max(0,n.indexOf(r)),a=Math.max(0,Math.min(n.length-1,i+e));a!==i&&ge(n[a])}async function ve(){if(!w){w=!0,P(t.getState());try{await t.dispatch({type:`ADVANCE_PHASE`})}finally{w=!1,P(t.getState())}}}function ye(e,t,n=!1){e.addEventListener(`click`,r=>{if(e.dataset.suppressClick===`true`){r.preventDefault();return}F(t(),n)})}function be(e,t){let n=null,r=null,i=!1,a=()=>{clearTimeout(n),clearInterval(r),i&&(e.dataset.suppressClick=`true`,setTimeout(()=>{delete e.dataset.suppressClick},120))};e.addEventListener(`pointerdown`,e=>{!I()||e.pointerType===`mouse`||(i=!1,n=setTimeout(()=>{i=!0,F(t()),r=setInterval(()=>F(t()),ca)},sa))}),[`pointerup`,`pointercancel`,`pointerleave`].forEach(t=>e.addEventListener(t,a))}function xe(e){e.addEventListener(`pointerdown`,e=>{I()&&(k={x:e.clientX,y:e.clientY,opened:!1,timer:setTimeout(()=>{k.opened=!0,E=`life`,Ae(!0),P(t.getState())},sa)})}),e.addEventListener(`pointerup`,t=>{if(!k||!I()){k=null;return}clearTimeout(k.timer);let n=k;if(k=null,n.opened||Math.abs(t.clientX-n.x)>14||Math.abs(t.clientY-n.y)>14)return;let r=e.getBoundingClientRect();F({type:`LIFE_DELTA`,amount:t.clientX>r.left+r.width/2||t.clientY<r.top+r.height/2?1:-1})}),e.addEventListener(`pointercancel`,()=>{clearTimeout(k?.timer),k=null})}function Se(e){e.addEventListener(`pointerdown`,e=>{I()&&(A={x:e.clientX,y:e.clientY,opened:!1,timer:setTimeout(()=>{A.opened=!0,E=`commander`,Ae(!0),P(t.getState())},sa)})}),e.addEventListener(`pointerup`,e=>{if(!A||!I()){A=null;return}clearTimeout(A.timer);let t=A;A=null,!(t.opened||Math.abs(e.clientX-t.x)>14||Math.abs(e.clientY-t.y)>14)&&F({type:`COMMANDER_DAMAGE_DELTA`,opponentId:`opponent`,amount:1})}),e.addEventListener(`pointercancel`,()=>{clearTimeout(A?.timer),A=null})}function Ce(e,n){n.settings?.gestures?.advanced&&e.querySelectorAll(`[data-permanent-card]`).forEach(e=>{let n=e.dataset.permanentId;!n||e.dataset.readonly===`true`||(e.addEventListener(`touchstart`,e=>{e.touches.length===2&&(e.preventDefault(),t.dispatch({type:`SELECT_PERMANENT`,id:n}),b=`inspect`,v=!1,P(t.getState()))},{passive:!1}),e.addEventListener(`pointerdown`,e=>{if(e.target.closest(`[data-tap], [data-counter], .mini button`))return;let r=Date.now(),i={id:n,startX:e.clientX,startY:e.clientY,moved:!1,startedAt:r,longPressFired:!1,reordered:!1,timer:setTimeout(()=>{i.longPressFired=!0,t.dispatch({type:`SELECT_PERMANENT`,id:n}),ae=``,v=!0,b=``,Ae(!0),P(t.getState())},sa)};ce.set(n,i)}),e.addEventListener(`pointermove`,e=>{let r=ce.get(n);if(!r)return;let i=e.clientX-r.startX,a=e.clientY-r.startY;(Math.abs(i)>6||Math.abs(a)>6)&&(r.moved=!0),r.longPressFired&&!r.reordered&&Math.abs(i)>da&&Math.abs(i)>Math.abs(a)&&(r.reordered=!0,t.dispatch({type:`REORDER_PERMANENT`,id:n,direction:i>0?1:-1}))}),e.addEventListener(`pointerup`,r=>{let i=ce.get(n);if(!i||(clearTimeout(i.timer),ce.delete(n),i.longPressFired||i.reordered))return;let a=r.clientX-i.startX,o=r.clientY-i.startY;if(o<-ua&&r.clientY<window.innerHeight*fa){t.dispatch({type:`DECLARE_ATTACKERS`,ids:[n]});return}if(Math.abs(o)>ua&&Math.abs(o)>Math.abs(a)*1.2){t.dispatch({type:`ADD_COUNTER`,id:n,counterType:o<0?`+1/+1`:`-1/-1`,amount:1});return}let s=Number(e.dataset.lastTapAt||0),c=Date.now();if(c-s<la){e.dataset.lastTapAt=`0`,t.dispatch({type:`TOGGLE_TAPPED`,id:n});return}e.dataset.lastTapAt=String(c),!i.moved&&c-i.startedAt<sa&&t.dispatch({type:`SELECT_PERMANENT`,id:n})}),e.addEventListener(`pointercancel`,()=>{let e=ce.get(n);e&&(clearTimeout(e.timer),ce.delete(n))}))})}function we(e,n){n.settings?.navigation?.edgeSwipeShortcuts&&e.querySelectorAll(`[data-edge-zone]`).forEach(e=>{e.addEventListener(`pointerdown`,n=>{let r=e.dataset.edgeZone;if(r===`left`){_e(-1);return}if(r===`right`){x=!0,S||=`triggers`,P(t.getState());return}if(r===`bottom`){y=!0,b=``,v=!1,P(t.getState());return}r===`top`&&(x=!0,S=`history`,P(t.getState()))})})}function Te(e,n){if(!(e.settings?.helperSprite||{}).enabled)return clearTimeout(me),M=null,null;if(m||h||ue||E||d)return M;let r=Date.now(),i=Ee(e,n);if(!i.length)return M=null,null;let a=(e.activeSession.helper||{}).replayQueue||[],o=(a[0]?{key:a[0].key,text:a[0].text,source:a[0].source||`remind-me`,isReminderReplay:!0}:null)||i[0];return!o||(N.get(o.key)||0)>r||M?.key===o.key?M:(M={...o,shownAt:r},clearTimeout(me),me=setTimeout(()=>{De(!0)},Math.max(2800,Math.min(6400,2300+Math.round(o.text.length*12)))),t.dispatch({type:`HELPER_MARK_SHOWN`,messageKey:o.key}),M)}function Ee(e,t){let n=e.activeSession,r=[],i=bo(e),a=(n.triggerQueue||[]).filter(e=>e.status===`pending`),c=(n.pendingEffects||[]).filter(e=>e.status===`pending`),l=(n.pendingEffects||[]).filter(e=>e.status===`ignored`),u=X(n).filter(e=>Number(e.quantity||1)>1),d=Object.values(n.manaPool||{}).reduce((e,t)=>e+Number(t||0),0);if(a.length){let e=a[0];r.push({key:`queue:${e.id}`,source:`trigger-queue`,text:`Trigger ready: ${e.sourceName} (${e.eventType}).`})}if(c.length){let e=c[0];r.push({key:`manual:${e.id}`,source:`pending-effects`,text:`Manual choice required: ${e.summary||e.effect?.summary||e.effect?.reason||`Resolve or skip from pending effects.`}`})}return l.length&&i.enabled&&r.push({key:`ignored:${l[0].id}`,source:`pending-effects`,text:`Ignored manual effect still unresolved. Open pending effects to review.`}),u.length&&r.push({key:`stack:${u.map(e=>e.id).join(`,`)}`,source:`stack-removal`,text:`Stack selected: use Remove 1 / Custom / All in Permanent Controls.`}),t===`battlefield`&&n.phaseIndex===2&&!n.combat?.attackerIds?.length&&r.push({key:`combat:${n.turn}:${n.phaseIndex}`,source:`combat`,text:`Combat reminder: declare attackers or advance phase.`}),t===`battlefield`&&n.phaseIndex===0&&r.push({key:`phase:${n.turn}:${n.phaseIndex}`,source:`phase`,text:`Beginning phase: resolve upkeep/beginning triggers before moving on.`}),i.enabled&&d>0&&r.push({key:`mana:${n.turn}:${d}`,source:`resource`,text:`Floating mana reminder: ${d} mana still available.`}),t===`battlefield`&&s&&r.push({key:`search-loading:${o}`,source:`search`,text:`Scryfall search is loading. You can keep typing.`}),r}function De(e=!1){M&&(clearTimeout(me),e&&M.key&&N.set(M.key,Date.now()+25e3),M.isReminderReplay&&t.dispatch({type:`HELPER_DISMISS_MESSAGE`,messageKey:M.key}),M=null,P(t.getState()))}function F(e,n=!1){t.dispatch(e),Ae(n)}function Oe(e=[],t=`custom`){let n=String(t||`custom`).toLowerCase(),r=Object.fromEntries(e.map(e=>[e.id,Math.max(1,Number(e.quantity||1))]));if(n===`all`)return{countMode:`all`,count:Math.max(...Object.values(r)),countById:r};if(n===`single`||n===`1`)return{countMode:`single`,count:1,countById:Object.fromEntries(e.map(e=>[e.id,1]))};let i=Math.max(...Object.values(r)),a=prompt(`Remove how many from each selected stack? (1-${i}, or "all")`,`1`);if(a===null)return null;let o=String(a).trim().toLowerCase();if(o===`all`)return{countMode:`all`,count:i,countById:r};let s=Math.max(1,Math.floor(Number(o)||1));return{countMode:`custom`,count:s,countById:Object.fromEntries(e.map(e=>[e.id,Math.min(r[e.id],s)]))}}function ke(){let e=Number(de.value)||1,t=de.scopes||{};t.life&&F({type:`LIFE_DELTA`,amount:e}),[`poison`,`energy`,`experience`,`tickets`].forEach(n=>{t[n]&&F({type:`PLAYER_COUNTER_DELTA`,counter:n,amount:e})}),t.commander&&F({type:`COMMANDER_DAMAGE_DELTA`,opponentId:`opponent`,amount:e})}function Ae(e=!1){!I()||window.matchMedia?.(`(prefers-reduced-motion: reduce)`)?.matches||!navigator.vibrate||navigator.vibrate(e?24:8)}function je(e){return!!e.closest(`button, input, label, textarea, select, .overlay-backdrop, .scroll-safe, .counter-stepper, .tile-grid, .search-results, .floating-tool-panel, .floating-mana, [data-no-swipe]`)}function I(){return window.matchMedia?.(ia)?.matches||!1}function Me(){fe||(fe=!0,document.addEventListener(`touchmove`,e=>{r===`life`&&I()&&e.touches.length>1&&e.target.closest(`.life-tracker-page`)&&e.preventDefault()},{passive:!1}),document.addEventListener(`gesturestart`,e=>{r===`life`&&I()&&e.target.closest(`.life-tracker-page`)&&e.preventDefault()}),document.addEventListener(`touchend`,e=>{if(r!==`life`||!I()||!e.target.closest(`.life-tracker-page`))return;let t=Date.now();t-pe<300&&e.preventDefault(),pe=t},{passive:!1}))}function Ne(e){clearTimeout(O),!(!y||e.settings?.battlefield?.manaPinned)&&(O=setTimeout(()=>{y=!1,P(t.getState())},5e3))}async function Pe(e,n,r=!1){let c=String(e||``).trim();o=String(e||``);let f=++l;if(!c&&!r){s=!1,i=[],a=`Start typing to search Scryfall.`,P(t.getState());return}let p=n.commanders?.[n.activeSession.commander?.deckKey]?.cards||[];u?.abort(),u=new AbortController,s=!0,a=navigator.onLine?`Searching...`:`Offline: showing commander deck matches only.`,d||P(t.getState());try{let e=await Wi(c,p,{requestToken:f,signal:u.signal});if(f!==l)return;i=e,a=i.length?`${i.length} result(s)`:`No results found.`}catch{if(f!==l)return;a=`Search unavailable right now.`}finally{f===l&&(s=!1,P(t.getState()))}}function Fe(e){let t=e.querySelector?.(`.app-shell`);return{pageY:window.scrollY||document.documentElement.scrollTop||0,shellY:t?.scrollTop||0}}function Ie(e,t){if(!t)return;Math.abs((window.scrollY||0)-(t.pageY||0))>1&&window.scrollTo({top:t.pageY||0,left:0,behavior:`auto`});let n=e.querySelector?.(`.app-shell`);n&&Number.isFinite(t.shellY)&&Math.abs((n.scrollTop||0)-t.shellY)>1&&(n.scrollTop=t.shellY)}function Le(){let e=document.activeElement;return e?.matches?.(`[data-search-query]`)?{shouldFocus:Date.now()>=p,start:e.selectionStart,end:e.selectionEnd,direction:e.selectionDirection||`none`}:{shouldFocus:d&&Date.now()>=p,start:f.start,end:f.end,direction:f.direction}}function Re(e,t,n){let r=e.querySelector(`.search-results`);if(r&&Number.isFinite(n)&&n>0&&(r.scrollTop=n),!t?.shouldFocus||Date.now()<p)return;let i=e.querySelector(`[data-search-query]`);if(!i)return;i.focus({preventScroll:!0});let a=Number.isFinite(t.start)?t.start:o.length,s=Number.isFinite(t.end)?t.end:a;try{i.setSelectionRange(a,s,t.direction||`none`)}catch{i.setSelectionRange(a,s)}}function ze(e){let t=e.querySelector?.(`.search-results`);return t&&t.scrollTop||0}}function ga(e,t,n,r,i){e.activeSession;let a=i.visiblePages||To(e),o=i.uiLayerState||yo(e,t,i);return`
    <main class="app-shell ${[`ui-layer-${o.current}`,o.passive?`ui-layer-passive`:``,o.active?`ui-layer-active`:``,o.focus?`ui-layer-focus`:``,o.inspect?`ui-layer-inspect`:``,o.adhd?`ui-layer-adhd`:``].filter(Boolean).join(` `)}" data-ui-layer="${$(o.current)}" data-app-shell>
      <header class="app-header glass">
        <div class="app-header-top">
          <div>
            <h1>BoardState</h1>
          </div>
          <div class="header-actions">
            <button class="pill" data-game-options>Game Options</button>
            <button class="pill" data-undo>Undo</button>
          </div>
        </div>
        <nav class="tab-bar">
          ${a.map(e=>`<button class="${t===e?`active`:``}" data-page="${e}" aria-current="${t===e?`page`:`false`}">${Po(e)}</button>`).join(``)}
        </nav>
        ${xa(a,t)}
      </header>
      ${t===`life`?_a(e,i.trackerModifier,i):``}
      ${t===`battlefield`?Da(e,n,r,i.searchLoading,i.searchQuery,i.combatResolving,i.toolContext,new Set(i.expandedStackIds||[]),i.activeUtilityPanel,o.current,{opponentBoardIndex,opponentOverlayOpen}):``}
      ${t===`profile`?oo(e):``}
      ${t===`archive`?so(e):``}
      ${t===`decks`?co(e,n,r,i.searchLoading,i.searchQuery):``}
      ${t===`leaderboards`?lo(e):``}
      ${t===`battlefield`?Ya(e,i.toolMenuOpen,i.floatingManaOpen,i.activeToolPanel,i.toolBadgePosition,i.toolContext):``}
      ${t===`battlefield`?Wa(e,i.utilityDockOpen,i.activeUtilityPanel):``}
      ${i.quickPanelOpen?Ta(e,i.quickPanelOpen):``}
      ${i.modifierPanelOpen?Ca(i.pendingTrackerModifier):``}
      ${i.optionsOpen?uo(e):``}
      ${i.statsOpen?fo(e,i.statsMode):``}
      ${va(e,i.simulationLogOpen)}
      ${i.simulationSetupOpen?ya(i.simulationSelectedOpponents,i.simulationSelectedSpeed):``}
      ${xo(e,t,o.current)}
      ${So(e,i.helperMessage)}
      ${Ka(e)}
    </main>
  `}function _a(e,t,n={}){let r=e.activeSession,i=wo(e),a={poison:r.playerCounters?.poison||0,energy:r.playerCounters?.energy||0,experience:r.playerCounters?.experience||0,tickets:r.playerCounters?.tickets||0},o=r.commander.damageByOpponent?.opponent||0,s=r.gameTracking||{},c=r.simulation||{};return`
    <section class="life-tracker-page">
      ${i.lifeTrackerLife?`
      <aside class="life-panel life-hero glass">
        <span class="eyebrow">Life Total</span>
        <strong data-life-gesture title="Tap right/top to add life, left/bottom to subtract">${r.life}</strong>
        <div class="life-actions">
          <button class="mobile-step" data-life-delta="-10">-10</button>
          <button class="mobile-step" data-life-delta="-5">-5</button>
          <button data-life-delta="-1">-</button>
          <button data-life-delta="1">+</button>
          <button class="mobile-step" data-life-delta="5">+5</button>
          <button class="mobile-step" data-life-delta="10">+10</button>
        </div>
        ${Sa(t)}
        <div class="button-grid life-start-controls">
          <button data-start-game-tracking>${s.active?`Game Tracking Active`:`Start Game`}</button>
          <button data-open-simulation-setup>${c.enabled?`Reconfigure Simulation`:`Start Simulation`}</button>
        </div>
      </aside>
      `:``}
      <section class="tracker-stack">
        <article class="tracker-card simulation-card glass">
          <p class="eyebrow">Simulated Multiplayer</p>
          <h2>${c.enabled?`Simulation Active`:`Commander Test Mode`}</h2>
          <p>${c.enabled?`Current: ${Q(ba(e))}`:`Play against Alpha, Beta, and Omega NPC opponents.`}</p>
          <div class="button-grid">
            <button data-open-simulation-setup>${c.enabled?`Reconfigure Simulation`:`Start Simulation`}</button>
            ${c.enabled?`<button data-simulation-log-toggle>${n.simulationLogOpen?`Hide Log`:`Show Log`}</button>`:``}
          </div>
        </article>
        <article class="tracker-card player-counters-card glass">
          <p class="eyebrow">Player Counters</p>
          <h2>Resources</h2>
          <div class="counter-grid">
            ${Object.entries(a).map(([e,t])=>Ea(e,t,`player`)).join(``)}
          </div>
        </article>
        <article class="tracker-card commander-damage-card glass">
          <p class="eyebrow">Commander Damage</p>
          <h2>One Opponent</h2>
          ${Ea(`damage`,o,`commander`)}
        </article>
      </section>
    </section>
  `}function va(e,t=!1){let n=e.activeSession?.simulation||{};if(!n.enabled)return``;let r=n.status===`running`,i=ba(e),a=n.log||[];return`
    <section class="simulation-hud glass" data-no-swipe>
      <div class="overlay-header compact">
        <div>
          <p class="eyebrow">Simulation status</p>
          <h2>${r?`Running`:Q(Z(n.status||`paused`))}</h2>
          <strong>${Q(i)}</strong>
        </div>
        <button data-simulation-log-toggle>${t?`Hide Log`:`Show Log`}</button>
      </div>
      <div class="button-grid">
        ${r?`<button data-simulation-pause>Pause</button>`:`<button data-simulation-resume>Resume</button>`}
        <button data-simulation-pass-turn>Pass Turn</button>
        <button data-simulation-stop>Stop</button>
      </div>
      ${t?`
        <article class="simulation-log">
          ${(a||[]).slice(0,20).map(e=>`<p><strong>${Q(e.actorId||`system`)}</strong> · ${Q(e.text||``)}</p>`).join(``)||`<p>No simulation actions yet.</p>`}
        </article>
      `:``}
    </section>
  `}function ya(e=[],t=`normal`){let n=new Set(e||[]),r=t||`normal`,i=en(`alpha`),a=en(`beta`),o=en(`omega`);return`
    <section class="overlay-backdrop">
      <div class="floating-overlay glass simulation-setup">
        <div class="overlay-header">
          <div>
            <p class="eyebrow">Commander NPC Setup</p>
            <h2>Start Simulation</h2>
          </div>
          <button data-close-simulation-setup>Cancel</button>
        </div>
        <article class="option-card">
          <h3>Choose Opponents</h3>
          <label class="toggle-row"><span>Alpha · ${Q(i?.deckName||`Deck`)}</span><input type="checkbox" data-sim-opponent="alpha" ${n.has(`alpha`)?`checked`:``} /></label>
          <label class="toggle-row"><span>Beta · ${Q(a?.deckName||`Deck`)}</span><input type="checkbox" data-sim-opponent="beta" ${n.has(`beta`)?`checked`:``} /></label>
          <label class="toggle-row"><span>Omega · ${Q(o?.deckName||`Deck`)}</span><input type="checkbox" data-sim-opponent="omega" ${n.has(`omega`)?`checked`:``} /></label>
          <p class="eyebrow">Deck status: ${Q(i?.status||`unknown`)} / ${Q(a?.status||`unknown`)} / ${Q(o?.status||`unknown`)}</p>
        </article>
        <article class="option-card">
          <h3>Simulation Speed</h3>
          <label class="toggle-row"><span>Step</span><input type="radio" name="sim-speed" data-sim-speed="step" ${r===`step`?`checked`:``} /></label>
          <label class="toggle-row"><span>Normal</span><input type="radio" name="sim-speed" data-sim-speed="normal" ${r===`normal`?`checked`:``} /></label>
          <label class="toggle-row"><span>Fast</span><input type="radio" name="sim-speed" data-sim-speed="fast" ${r===`fast`?`checked`:``} /></label>
        </article>
        <div class="button-grid">
          <button data-start-simulation>Start Game</button>
          <button data-close-simulation-setup>Cancel</button>
        </div>
      </div>
    </section>
  `}function ba(e){let t=e.activeSession?.simulation||{};return t.enabled?t.currentPlayerId===`local-player`?`${e.player?.name||`Player`} (You)`:t.opponents?.[t.currentPlayerId]?.name||t.currentPlayerId||`NPC`:`No simulation`}function xa(e,t){let n=e.indexOf(t);return`
    <section class="mobile-swipe-controls glass" aria-label="Mobile screen navigation">
      <button data-mobile-nav="prev" aria-label="Previous screen">‹</button>
      <div>
        <span>${Po(t)}</span>
        <div class="mobile-page-dots" aria-hidden="true">
          ${e.map(e=>`<i class="${e===t?`active`:``}"></i>`).join(``)}
        </div>
      </div>
      <button data-mobile-nav="next" aria-label="Next screen">›</button>
      <small>${n+1}/${e.length}</small>
    </section>
  `}function Sa(e){return`
    <button class="modifier-badge" data-modifier-badge title="Long press to choose tracker modifier">
      <span>Modifier</span>
      <strong>${Q(Oo(e))}</strong>
      <small>${Q(ko(e))}</small>
    </button>
  `}function Ca(e){return`
    <section class="modifier-panel glass" data-no-swipe>
      <div class="overlay-header compact">
        <div>
          <p class="eyebrow">Increment modifier</p>
          <h2>${Q(Oo(e))}</h2>
        </div>
        <button data-cancel-modifier-panel>Cancel</button>
      </div>
      <p>Pick the modifier amount, then choose which Life Tracker increment badges it affects. Tap the Modifier button to apply it.</p>
      <div class="modifier-option-grid">
        ${[-10,-5,-1,1,5,10].map(t=>wa(t,`${t>0?`+`:``}${t}`,e)).join(``)}
      </div>
      <label class="modifier-custom-row">Custom/manual
        <input type="number" inputmode="numeric" data-modifier-custom placeholder="Amount" />
      </label>
      <div class="modifier-scope-grid">
        ${[[`life`,`Life total`],[`poison`,`Poison`],[`energy`,`Energy`],[`experience`,`Experience`],[`tickets`,`Tickets`],[`commander`,`Commander damage`]].map(([t,n])=>`
          <label>
            <input type="checkbox" data-modifier-scope="${t}" ${e.scopes?.[t]?`checked`:``} />
            ${n}
          </label>
        `).join(``)}
      </div>
      <div class="row modifier-actions">
        <button class="wide" data-clear-modifier>Clear modifier</button>
        <button class="wide primary" data-confirm-modifier-panel>Confirm</button>
      </div>
    </section>
  `}function wa(e,t,n){return`<button class="${Number(n.value)===e?`active`:``}" data-modifier-option="${e}">${t}</button>`}function Ta(e,t){let n=e.activeSession,r=t===`commander`,i=r?`Commander Damage`:`Life Total`,a=r?n.commander.damageByOpponent?.opponent||0:n.life,o=r?`<button data-commander-damage-set>Set manually</button>`:`<button data-life-set>Set life manually</button>`,s=r?`<button data-commander-damage-reset>Reset</button>`:`<button data-life-reset>Reset this player</button>`;return`
    <section class="quick-adjust-panel glass" data-no-swipe>
      <div class="overlay-header compact">
        <div>
          <p class="eyebrow">Quick adjustment</p>
          <h2>${i}: ${a}</h2>
        </div>
        <button data-close-quick-panel>Close</button>
      </div>
      <div class="button-grid">
        ${[-10,-5,-1,1,5,10].map(e=>r?`<button data-commander-damage data-delta="${e}">${e>0?`+`:``}${e}</button>`:`<button data-life-delta="${e}">${e>0?`+`:``}${e}</button>`).join(``)}
        ${o}
        ${s}
      </div>
    </section>
  `}function Ea(e,t,n){let r=Z(e),i=n===`commander`?`data-commander-damage`:`data-player-counter="${$(e)}"`,a=n===`commander`?`data-commander-value title="Tap to add commander damage; long press for more"`:``;return`
    <div class="counter-stepper counter-stepper--${$(n)}">
      <span>${Q(r)}</span>
      <div class="counter-stepper__controls">
        <button ${i} data-delta="-1">-</button>
        <strong ${a}>${t}</strong>
        <button ${i} data-delta="1">+</button>
      </div>
    </div>
  `}function Da(e,t,n,r,i,a,o,s,c,l=`passive`,u={}){let d=e.activeSession,f=w(e),p=wo(e),m=bo(e),h=e.settings?.battlefield?.detailMode||`standard`,g=e.settings?.battlefield?.compressionMode||`adaptive`,_=new Set(d.selectedIds||[]),v=qa(d.battlefield.player,g),y=qa(d.battlefield.opponent,g),b=Aa(e),x=b.length>0,S=x?Math.max(0,Math.min(b.length-1,Number(u.opponentBoardIndex)||0)):0,C=x?b[S]:null;return`
    <section class="battlefield-page battlefield-page--focused ui-layer-surface-${$(l)} ${m.enabled&&m.reducedNoise?`adhd-reduced-noise`:``}">
      <section class="arena glass ${v} ${e.settings?.battlefield?.focusMode&&d.selectedIds?.length?`focus-mode`:``} ${m.enabled&&m.reducedNoise?`adhd-reduced-noise`:``}" data-set-tool-context="empty">
        ${p.boardOpponent?`
        <div class="opponent-zone ${y}" data-opponent-swipe data-set-tool-context="empty">
          ${Oa(b,S,C)}
          ${C?Ma(C.permanents,{readonly:!0,allowTargeting:!0,emptyText:`No visible opponent permanents`,expandedAll:e.settings?.battlefield?.expandedAll,selectedIds:_,detailMode:h,compressionMode:g,expandedStackIds:s,session:d,settings:e.settings}):Io(`No visible opponent permanents`)}
        </div>
        `:``}
        ${p.boardCombat?`
        <div class="combat-zone">
          <h2>Combat</h2>
          <p>${d.combat.damagePreview?`${d.combat.damagePreview.total} damage estimated`:`Select attackers, then confirm combat.`}</p>
          <div class="row">
            <button data-declare-attackers ${a?`disabled`:``}>Declare Attackers</button>
            <button data-resolve-combat ${a?`disabled`:``}>${a?`Resolving…`:`Resolve`}</button>
          </div>
        </div>
        `:``}
        <div class="player-zone">
          <h2>Your Battlefield</h2>
          ${Ma(d.battlefield.player,{emptyText:`No permanents yet`,expandedAll:e.settings?.battlefield?.expandedAll,selectedIds:_,detailMode:h,compressionMode:g,expandedStackIds:s,session:d,settings:e.settings})}
        </div>
      </section>
      <aside class="search-panel glass">
        ${ja(d,f)}
        ${Ba(h,g,l)}
        ${e.settings?.helperSprite?.enabled?``:Va(e)}
        ${p.archiveQuickAdd?`<h2>Battlefield Quick Add</h2>`:``}
        ${p.archiveQuickAdd?Ja(t,n,r,i):``}
      </aside>
    </section>
    ${p.advancedRulesHelpers||(d.pendingEffects||[]).length?ao(d):``}
    ${c===`history`?Ha(e):``}
    ${c===`triggers`?Ua(e):``}
    ${u.opponentOverlayOpen&&C?ka(e,C,S,b.length,h,g,_,s):``}
  `}function Oa(e,t,n){return e.length?`
    <div class="opponent-zone-header">
      <div>
        <h2>${Q(n?.name||`Opponent Battlefield`)}</h2>
        <p class="eyebrow">${t+1}/${e.length} · ${Q(n?.deckName||`Opponent`)}</p>
      </div>
      <div class="row mini">
        ${e.length>1?`<button data-opponent-nav="prev">‹</button><button data-opponent-nav="next">›</button>`:``}
        <button data-open-opponent-overlay>Expand Battlefield</button>
      </div>
    </div>
  `:`<h2>Opponent Battlefield</h2>`}function ka(e,t,n,r,i,a,o,s){return`
    <section class="overlay-backdrop">
      <div class="floating-overlay glass opponent-battlefield-overlay" data-opponent-swipe>
        <div class="overlay-header">
          <div>
            <p class="eyebrow">Opponent Battlefield</p>
            <h2>${Q(t.name)}</h2>
            <strong>${n+1}/${r}</strong>
          </div>
          <div class="row mini">
            ${r>1?`<button data-opponent-nav="prev">‹</button><button data-opponent-nav="next">›</button>`:``}
            <button data-close-opponent-overlay>Close</button>
          </div>
        </div>
        ${Ma(t.permanents,{readonly:!0,allowTargeting:!0,emptyText:`No visible permanents`,expandedAll:e.settings?.battlefield?.expandedAll,selectedIds:o,detailMode:i===`compact`?`standard`:i,compressionMode:a,expandedStackIds:s,session:e.activeSession,settings:e.settings})}
      </div>
    </section>
  `}function Aa(e){let t=e.activeSession,n=new Map;(t.battlefield?.opponent||[]).forEach(e=>{let t=e.controller||`opponent`;n.has(t)||n.set(t,[]),n.get(t).push(e)});let r=new Map;return(e.settings?.multiplayer?.connectedPlayers||[]).filter(e=>e.id!==`local-player`).forEach(e=>{let t=(e.publicBoardSnapshot||[]).map(t=>b({id:t.id||`snapshot-${e.id}-${t.name}`,name:t.name||`Permanent`,typeLine:t.typeLine||`Permanent`,tapped:!!t.tapped,quantity:Number(t.quantity||1),counters:t.counters||{},controller:e.id,owner:e.id}));r.set(e.id,{id:e.id,name:e.name||e.id,deckName:e.deckName||e.publicBoardSnapshot?.deckName||`Opponent`,permanents:n.get(e.id)||t,life:Number(e.life??40)})}),Object.values(t.simulation?.opponents||{}).forEach(e=>{r.set(e.id,{id:e.id,name:e.name,deckName:e.deckName||`Simulation Deck`,permanents:n.get(e.id)||[],life:Number(e.life??40)})}),n.forEach((e,t)=>{r.has(t)||r.set(t,{id:t,name:t===`opponent`?`Opponent`:t,deckName:`Opponent`,permanents:e,life:40})}),[...r.values()].sort((e,t)=>e.name.localeCompare(t.name))}function ja(e,t){return`
    <section class="phase-tracker-card">
      <p class="eyebrow">Turn phase</p>
      <h2>Turn ${e.turn}</h2>
      <strong>${Q(f[e.phaseIndex])}</strong>
      <p>Board ${t.currentBoardSize} / Triggers ${t.triggersResolved}</p>
      <button class="wide" data-set-tool-context="player">Player Tool Context</button>
      <button class="wide" data-next-phase>Next Phase</button>
    </section>
  `}function Ma(e,t={}){if(!e.length)return Io(t.emptyText||`No permanents yet`);let n=e.filter(e=>!e.tapped),r=e.filter(e=>e.tapped);return`
    <div class="battlefield-groups">
      ${Na(`Untapped`,n,t)}
      ${Na(`Tapped`,r,{...t,tappedGroup:!0})}
    </div>
  `}function Na(e,t,n={}){if(!t.length)return``;let r=t.reduce((e,t)=>e+(Number(t.quantity)||1),0);return`
    <section class="battlefield-group ${n.tappedGroup?`tapped-zone`:`untapped-zone`}">
      <div class="battlefield-group-header">
        <span>${e}</span>
        <strong>${r}</strong>
      </div>
      <div class="tile-grid ${n.readonly?`readonly`:``} ${n.compressionMode===`compact`?`density-high`:``}">
        ${t.map(e=>Pa(e,n)).join(``)}
      </div>
    </section>
  `}function Pa(e,t={}){let n=t.selectedIds?.has(e.id),r=t.expandedAll||t.expandedStackIds?.has(e.id),i=t.detailMode||`standard`,a=e.stackMembers||[],o=La(e,t.session,t.settings),s=t.readonly?t.allowTargeting?`data-opponent-permanent="${$(e.id)}"`:``:`data-permanent="${e.id}"`;return`
    <article class="permanent detail-${i} ${n?`selected`:``} ${e.tapped?`tapped`:``} ${e.attacking?`attacking`:``} ${e.manualStatus===`pending`?`pending`:``}" data-permanent-card data-permanent-id="${e.id}" data-readonly="${t.readonly?`true`:`false`}">
      <button ${s}>
        <strong>${Q(e.name)}</strong>
        ${i===`compact`?`<span>MV ${e.manaValue||0}</span>`:`<span>${Q(e.typeLine)}</span>`}
        ${e.isCreature?`<b>${e.currentPower}/${e.currentToughness}</b>`:``}
        ${e.isPlaneswalker?`<b>Loyalty ${e.counters?.Loyalty||0}</b>`:``}
        ${e.quantity>1?`<i class="quantity">x${e.quantity}</i>`:``}
        ${e.isToken?`<em>TOKEN</em>`:``}
        ${e.isCommander?`<em>COMMANDER</em>`:``}
      </button>
      ${Ia(o)}
      ${i===`compact`?``:Fa(e,i)}
      ${e.quantity>1?`<button class="stack-toggle" type="button" data-toggle-stack="${e.id}">${r?`Collapse Stack`:`Expand Stack`}</button>`:``}
      ${r?za(a,i):``}
      ${t.readonly?``:`<div class="row mini">
        <button data-tap="${e.id}">${e.tapped?`Untap`:`Tap`}</button>
        <button data-counter="${e.id}">+1/+1</button>
      </div>`}
    </article>
  `}function Fa(e,t=`standard`){let n=Object.entries(e.counters||{}).filter(([,e])=>Number(e)>0),r=t===`inspect`?Ra(e.layerBreakdown||[]):``,i=t===`inspect`?`<span>Triggers: ${(e.triggeredAbilities||[]).length} · Static: ${(e.staticAbilities||[]).length}</span>`:``;return`
    <div class="permanent-details">
      ${n.length?`<span>${n.map(([e,t])=>`${Q(e)} ${t}`).join(` / `)}</span>`:`<span>No counters</span>`}
      ${e.keywords?.length?`<span>${e.keywords.map(Q).join(`, `)}</span>`:``}
      ${t===`inspect`?`<span>${Q(e.rulesText||e.oracleText||`No rules text`)}</span>`:``}
      ${i}
      ${r}
    </div>
  `}function Ia(e=[]){return e.length?`
    <div class="status-icon-row">
      ${e.map(e=>`
        <span class="status-icon status-${$(e.key)}" title="${$(e.label)}" aria-label="${$(e.label)}">
          ${Q(e.glyph)}
        </span>
      `).join(``)}
    </div>
  `:``}function La(e,t,n){let r=new Set((e.keywords||[]).map(e=>String(e||``).toLowerCase())),i=Object.values(e.counters||{}).some(e=>Number(e)>0),a=!!n?.adhdMode?.enabled,o=(t?.triggerQueue||[]).some(t=>t.status===`pending`&&t.sourceId===e.id)||(t?.pendingEffects||[]).some(t=>t.status===`pending`&&t.sourceId===e.id),s=r.has(`monarch`)||Number(t?.playerCounters?.monarch||0)>0,c=r.has(`initiative`)||Number(t?.playerCounters?.initiative||0)>0,l=i||(e.temporaryModifiers||[]).length>0||(e.layerBreakdown||[]).length>0;return[[`tapped`,!!e.tapped],[`summoningSickness`,!!e.summoningSick],[`flying`,r.has(`flying`)],[`trample`,r.has(`trample`)],[`vigilance`,r.has(`vigilance`)],[`menace`,r.has(`menace`)],[`deathtouch`,r.has(`deathtouch`)],[`lifelink`,r.has(`lifelink`)],[`ward`,r.has(`ward`)],[`counters`,i],[`commander`,!!e.isCommander],[`token`,!!e.isToken],[`monarch`,s],[`initiative`,c],[`attacking`,!!e.attacking],[`blocking`,!!e.blocking],[`modified`,l],[`triggered`,(e.triggeredAbilities||[]).length>0],[`staticEffect`,(e.staticAbilities||[]).length>0],[`replacementEffect`,(e.replacementEffects||[]).length>0],[`unresolvedTrigger`,o],[`adhdReminder`,a&&o]].filter(([,e])=>e).map(([e])=>({key:e,glyph:ma[e]?.glyph||e.slice(0,3).toUpperCase(),label:ma[e]?.label||e}))}function Ra(e=[]){return e.length?`<span>Layers: ${e.map(e=>`L${e.layer}:${e.operation}`).join(` · `)}</span>`:`<span>Layers: no active modifiers</span>`}function za(e=[],t=`standard`){return!e.length||t===`compact`?``:`
    <div class="stack-member-list">
      ${e.map(e=>`
        <span>
          ${e.instanceId}
          ${e.tapped?` · tapped`:``}
          ${Object.keys(e.counters||{}).length?` · ${Object.entries(e.counters).map(([e,t])=>`${e} ${t}`).join(`, `)}`:``}
        </span>
      `).join(``)}
    </div>
  `}function Ba(e,t,n=`passive`){return`
    <section class="phase-tracker-card">
      <p class="eyebrow">Battlefield display</p>
      <span>UI layer: ${Q(Z(n))}</span>
      <div class="button-grid">
        ${[`compact`,`standard`,`inspect`].map(t=>`<button class="${e===t?`active`:``}" data-set-detail-mode="${t}">${Z(t)}</button>`).join(``)}
      </div>
      <div class="button-grid">
        ${[`adaptive`,`compact`,`expanded`].map(e=>`<button class="${t===e?`active`:``}" data-set-compression-mode="${e}">${Z(e)}</button>`).join(``)}
      </div>
      <div class="button-grid">
        <button data-setting-button="battlefield.expandedAll" data-value="true">Expand Board Stacks</button>
        <button data-setting-button="battlefield.expandedAll" data-value="false">Collapse Board Stacks</button>
      </div>
    </section>
  `}function Va(e){let t=ra(e);return t.length?`
    <section class="phase-tracker-card">
      <p class="eyebrow">Predictive Actions</p>
      ${t.map(e=>`
        <article class="prediction-row">
          <strong>${Q(e.label)}</strong>
          <span>${Q(e.detail)}</span>
          ${e.apply?`<button data-prediction-apply="${$(e.id)}">Apply</button>`:``}
        </article>
      `).join(``)}
    </section>
  `:`
      <section class="phase-tracker-card">
        <p class="eyebrow">Predictive Actions</p>
        <p>No immediate suggestions.</p>
      </section>
    `}function Ha(e){return`
    <section class="utility-overlay glass history-timeline" data-no-swipe>
      <div class="overlay-header compact">
        <h2>Action Timeline</h2>
        <button data-close-utility-panel>Close</button>
      </div>
      <div class="timeline-controls row">
        <button data-undo>Undo</button>
        <button data-redo>Redo</button>
      </div>
      <div class="timeline-list scroll-safe">
        ${(e.activeSession.actionHistory||[]).slice(0,140).map(e=>`
          <article class="log-card">
            <strong>${Q(e.actionType)}</strong>
            <span>${new Date(e.timestamp).toLocaleTimeString()} · ${Q(e.playerId||`local-player`)}</span>
            <p>${Q(JSON.stringify(e.payload||{}))}</p>
            <button data-replay-action="${e.actionId}">Replay To Here</button>
          </article>
        `).join(``)||`<p>No actions yet.</p>`}
      </div>
    </section>
  `}function Ua(e){return`
    <section class="utility-overlay glass trigger-queue-panel" data-no-swipe>
      <div class="overlay-header compact">
        <h2>Trigger Queue</h2>
        <button data-close-utility-panel>Close</button>
      </div>
      <div class="timeline-list scroll-safe">
        ${(e.activeSession.triggerQueue||[]).map(e=>`
          <article class="log-card ${e.status===`pending`?`pending-trigger`:``}">
            <strong>${Q(e.sourceName)}</strong>
            <span>${Q(e.eventType)} · Chain ${Q(e.chainId)}</span>
            <p>Status: ${Q(e.status)}</p>
            ${e.effectDefinitions?.some(e=>e.manual)?`<p><strong>manual choice required</strong></p>`:``}
            <p>Effects: ${(e.effectDefinitions||[]).map(e=>Q(e.action||`effect`)).join(`, `)}</p>
            <p>Modifiers: ${(e.generatedModifiers||[]).map(e=>`L${e.layer}:${e.operation}`).join(` · `)||`none`}</p>
            <div class="row mini">
              <button data-trigger-resolve="${e.id}">Resolve</button>
              <button data-trigger-delay="${e.id}">Delay</button>
              <button data-trigger-skip="${e.id}">Skip</button>
              <button data-trigger-inspect="${e.id}">Inspect</button>
            </div>
          </article>
        `).join(``)||`<p>No queued triggers.</p>`}
      </div>
    </section>
  `}function Wa(e,t,n){let r=Object.values(e.activeSession.manaPool||{}).reduce((e,t)=>e+Number(t||0),0);return`
    <section class="utility-dock ${t?`open`:``}">
      <button class="utility-dock-toggle glass" data-toggle-utility-dock>${t?`Close`:`Utility`}</button>
      ${t?`
        <div class="utility-dock-menu glass">
          <button data-open-utility="dice">Dice</button>
          <button data-open-utility="tokens">Token Gen</button>
          <button data-open-utility="mana">Mana ${r?`(${r})`:``}</button>
          <button data-open-utility="calculator">Calculator</button>
          <button data-open-utility="notes">Notes</button>
          <button data-open-utility="phase">Phase</button>
          <button data-open-utility="triggers">Queue</button>
          <button data-open-utility="history">History</button>
          <button data-open-utility="rules">Rules</button>
        </div>
      `:``}
      ${Ga(e,n)}
    </section>
  `}function Ga(e,t){if(!t||t===`history`||t===`triggers`)return``;let n=e.activeSession,r=e.settings?.playerNotes?.dock||``,i=e.settings?.utility?.lastDice||`d20: 1`,a=e.settings?.utility?.calculator||``,o=X(n)[0]?.rulesText||X(n)[0]?.oracleText||`Select a permanent to inspect rules.`;return`
    <section class="utility-overlay glass" data-no-swipe>
      <div class="overlay-header compact">
        <h2>${Q(Z(t))}</h2>
        <button data-close-utility-panel>Close</button>
      </div>
      ${t===`dice`?`
        <div class="button-grid">
          <button data-roll-dice="6">Roll d6</button>
          <button data-roll-dice="20">Roll d20</button>
          <button data-roll-dice="100">Roll d100</button>
        </div>
        <p>${Q(i)}</p>
      `:``}
      ${t===`tokens`?`
        <button class="wide" data-open-tool-panel="tokens">Open Token Generator</button>
      `:``}
      ${t===`mana`?`
        <button class="wide" data-open-floating-mana>Open Floating Mana</button>
      `:``}
      ${t===`calculator`?`
        <input data-utility-calculator value="${$(a)}" placeholder="e.g. (6+4)*2-3" />
        <button class="wide" data-run-calculator>Calculate</button>
      `:``}
      ${t===`notes`?`
        <textarea data-utility-note rows="5" placeholder="Game notes">${Q(r)}</textarea>
        <button class="wide" data-save-utility-note>Save Note</button>
      `:``}
      ${t===`phase`?`
        <p>FSM ${Q(n.fsm?.current||`setup`)} · Turn ${n.turn}</p>
        <button class="wide" data-next-phase>Advance Phase</button>
      `:``}
      ${t===`rules`?`
        <p>${Q(o)}</p>
        <button class="wide" data-open-tool-panel="inspect">Inspect Selected Permanent</button>
      `:``}
    </section>
  `}function Ka(e){return e.settings?.navigation?.edgeSwipeShortcuts?`
    <div class="edge-swipe-zone edge-left" data-edge-zone="left" aria-hidden="true"></div>
    <div class="edge-swipe-zone edge-right" data-edge-zone="right" aria-hidden="true"></div>
    <div class="edge-swipe-zone edge-bottom" data-edge-zone="bottom" aria-hidden="true"></div>
    <div class="edge-swipe-zone edge-top" data-edge-zone="top" aria-hidden="true"></div>
  `:``}function qa(e=[],t=`adaptive`){if(t===`compact`)return`density-high`;if(t===`expanded`)return`density-low`;let n=e.reduce((e,t)=>e+(Number(t.quantity)||1),0);return n>=18?`density-high`:n>=10?`density-medium`:`density-low`}function Ja(e,t,n=!1,r=``){return`
    <form class="search-box" data-search-form>
      <label>Scryfall Search</label>
      <div class="row">
        <input name="query" data-search-query value="${$(r)}" placeholder="Card, token, land, spell" />
        <button ${n?`disabled`:``}>${n?`Searching…`:`Search`}</button>
      </div>
      <p>${Q(t||`Works offline with saved commander deck matches.`)}</p>
    </form>
    <div class="search-results scroll-safe" data-no-swipe>
      ${e.map((e,t)=>`
        <article>
          <strong>${Q(e.name)}</strong>
          <span>${Q(e.typeLine||``)}</span>
          <div class="row mini">
            ${e.isInstant||e.isSorcery||/\b(Instant|Sorcery)\b/i.test(e.typeLine||``)?`<button data-cast-result="${t}">Cast</button>`:`<button data-add-result="${t}">Add</button>`}
            <button data-deck-result="${t}">Deck</button>
            <button data-inspect-result="${t}">Inspect</button>
            ${Ct(e)?`<button data-commander-result="${t}">Commander</button>`:``}
          </div>
        </article>
      `).join(``)}
    </div>
  `}function Ya(e,t,n,r,i,a){let o=!!e.settings?.battlefield?.manaPinned,s=`left:${Math.round(i.x)}px;top:${Math.round(i.y)}px;`,c=Xa(a,n||o);return`
    <div class="battlefield-tool-system">
      <button class="tool-badge glass" style="${s}" data-tool-badge aria-label="Battlefield tools">Tools</button>
      ${t?`
      <section class="radial-menu glass" style="${s}">
        <p class="radial-context-label">Context: ${Q(Z(a))}</p>
        ${c.map(e=>Za(e)).join(``)}
      </section>
      `:``}
      ${r?$a(e,r,a):``}
      ${n||o?Qa(e,o):``}
    </div>
  `}function Xa(e,t){let n=[{type:`panel`,panel:`player`,label:`Player Controls`},{type:`utility`,panel:`triggers`,label:`Utility Dock`},{type:`options`,label:`Game Options`},{type:`mana`,label:t?`Hide Floating Mana`:`Floating Mana Controls`}];return e===`player`?n:e===`empty`?[{type:`panel`,panel:`tokens`,label:`Token Controls`},...n]:e===`token`?[{type:`panel`,panel:`tokens`,label:`Token Controls`},{type:`panel`,panel:`counters`,label:`Permanent Counter Controls`},{type:`panel`,panel:`permanents`,label:`Permanent Controls`},{type:`panel`,panel:`inspect`,label:`Inspect`},...n]:e===`stack`?[{type:`panel`,panel:`tokens`,label:`Token Stack Controls`},{type:`panel`,panel:`permanents`,label:`Permanent Controls`},{type:`panel`,panel:`inspect`,label:`Inspect Stack`},...n]:e===`commander`?[{type:`panel`,panel:`commander`,label:`Commander Tools`},{type:`panel`,panel:`counters`,label:`Permanent Counter Controls`},{type:`panel`,panel:`permanents`,label:`Permanent Controls`},{type:`panel`,panel:`inspect`,label:`Inspect`},...n]:e===`creature`||e===`permanent`?[{type:`panel`,panel:`permanents`,label:`Permanent Controls`},{type:`panel`,panel:`counters`,label:`Permanent Counter Controls`},{type:`panel`,panel:`inspect`,label:`Inspect`},...n]:n}function Za(e){return e.type===`panel`?`<button data-open-tool-panel="${$(e.panel)}">${Q(e.label)}</button>`:e.type===`options`?`<button data-open-game-options>${Q(e.label)}</button>`:e.type===`utility`?`<button data-open-utility="${$(e.panel||`triggers`)}">${Q(e.label)}</button>`:`<button data-open-floating-mana>${Q(e.label)}</button>`}function Qa(e,t){let n=e.activeSession,r=Object.entries(n.manaPool);return`
    <section class="floating-mana glass ${t?`pinned`:``}">
      <div class="overlay-header compact">
        <h2>Floating Mana</h2>
        ${t?`<span class="eyebrow">Pinned</span>`:``}
        <button data-close-tool-panel>Close</button>
      </div>
      <div class="mana-control-grid">
        ${r.map(([e,t])=>`
          <div class="mana-row">
            <button data-mana-minus="${e}">-</button>
            <strong>${No(e)} ${t}</strong>
            <button data-mana="${e}">+</button>
          </div>
        `).join(``)}
      </div>
      <div class="row">
        <button class="wide" data-clear-mana>Clear Mana Pool</button>
        <button class="wide" data-setting-button="battlefield.manaPinned" data-value="${t?`false`:`true`}">${t?`Unpin`:`Pin`}</button>
      </div>
    </section>
  `}function $a(e,t){return`
    <section class="floating-tool-panel glass" data-floating-tool-panel>
      <div class="overlay-header compact">
        <h2>${{tokens:`Token Controls`,permanents:`Permanent Controls`,player:`Player Controls`,counters:`Permanent Counter Controls`,inspect:`Inspect`,commander:`Commander Tools`}[t]||`Battlefield Tool`}</h2>
        <button data-close-tool-panel>Close</button>
      </div>
      ${t===`tokens`?to():``}
      ${t===`permanents`?no(e):``}
      ${t===`player`?eo(e):``}
      ${t===`counters`?ro(e):``}
      ${t===`inspect`?ho(e):``}
      ${t===`commander`?io(e):``}
    </section>
  `}function eo(e){let t=e.activeSession,n=e.settings?.playerNotes?.session||``;return`
    <div class="player-control-widget">
      <article class="phase-tracker-card">
        <p class="eyebrow">Current turn</p>
        <h2>Turn ${t.turn}</h2>
        <strong>${Q(f[t.phaseIndex])}</strong>
      </article>
      <div class="button-grid">
        <button data-open-life-quick>Life</button>
        <button data-open-commander-quick>Commander Damage</button>
        <button data-player-counter-delta="poison" data-delta="1">Poison +1</button>
        <button data-player-counter-delta="energy" data-delta="1">Energy +1</button>
      </div>
      <div class="button-grid">
        <button data-player-life-delta="-1">Life -1</button>
        <button data-player-life-delta="1">Life +1</button>
        <button data-player-life-delta="-5">Life -5</button>
        <button data-player-life-delta="5">Life +5</button>
      </div>
      <label class="stacked-form">Notes
        <textarea rows="3" data-player-note-input placeholder="Table notes, reminders, politics...">${Q(n)}</textarea>
      </label>
      <button class="wide" data-save-player-note>Save notes</button>
      <div class="button-grid">
        <button data-cast-commander>Cast Commander</button>
        <button data-next-phase>Next Phase</button>
        <button data-activate-board>Activate Board</button>
        <button data-archive-game>Archive Game</button>
        <button data-life-reset>Reset Player Trackers</button>
        <button data-undo>Undo</button>
      </div>
    </div>
  `}function to(){return`
    <div class="stacked-form">
      <form class="stacked-form" data-token-form>
        <label>Token name<input name="tokenName" value="Generic Token" /></label>
        <div class="form-grid-2">
          <label>Power<input name="power" type="number" inputmode="numeric" value="1" /></label>
          <label>Toughness<input name="toughness" type="number" inputmode="numeric" value="1" /></label>
        </div>
        <label>Quantity<input name="quantity" type="number" min="1" inputmode="numeric" value="1" /></label>
        <label>Token type<input name="tokenType" value="Creature" placeholder="Creature, Artifact, Treasure..." /></label>
        <label class="toggle-row"><span>Tapped</span><input name="tapped" type="checkbox" /></label>
        <button class="wide">Add token to battlefield</button>
      </form>
      <div class="button-grid">
        <button data-token-remove-selected>Remove selected token(s)</button>
        <button data-setting-button="battlefield.expandedAll" data-value="true">Expand token stacks</button>
        <button data-setting-button="battlefield.expandedAll" data-value="false">Collapse token stacks</button>
      </div>
    </div>
  `}function no(e){let t=e.activeSession.selectedIds?.length||0,n=!!e.settings?.battlefield?.expandedAll,r=X(e.activeSession).filter(e=>Number(e.quantity||1)>1),i=r.reduce((e,t)=>Math.max(e,Number(t.quantity||1)),0);return`
    <div class="stacked-form">
      <p class="eyebrow">${t} selected permanent(s)</p>
      <div class="button-grid">
        <button data-selected-action="tap">Tap selected</button>
        <button data-selected-action="untap">Untap selected</button>
        <button data-selected-action="destroy">Destroy selected</button>
        <button data-selected-action="exile">Exile selected</button>
        <button data-selected-action="sacrifice">Sacrifice selected</button>
        <button data-selected-action="remove">Remove selected</button>
        <button data-selected-action="inspect">Inspect selected</button>
        <button data-setting-button="battlefield.expandedAll" data-value="${n?`false`:`true`}">${n?`Collapse all permanents`:`Expand all permanents`}</button>
        <button data-selected-action="clear">Clear selected permanents</button>
      </div>
      ${r.length?`
        <div class="stacked-form stack-removal-card">
          <p class="eyebrow">Stack quantity removal (${r.length} stack${r.length===1?``:`s`} selected, max ${i})</p>
          <label>Removal mode
            <select data-stack-remove-mode>
              <option value="destroy">Destroy</option>
              <option value="exile">Exile</option>
              <option value="sacrifice">Sacrifice</option>
              <option value="bounce">Bounce / Return</option>
              <option value="remove">Generic Remove</option>
            </select>
          </label>
          <div class="button-grid">
            <button data-stack-remove="single">Remove 1</button>
            <button data-stack-remove="custom">Remove Custom</button>
            <button data-stack-remove="all">Remove All</button>
          </div>
        </div>
      `:``}
    </div>
  `}function ro(e){let t=e.settings?.recentCounterTypes||[`+1/+1`,`-1/-1`,`Loyalty`,`Charge`,`Shield`];return`
    <form class="stacked-form" data-counter-form>
      <label>Counter type<input name="counterType" data-counter-type-input value="${$(t[0]||`+1/+1`)}" /></label>
      <label>Quantity<input name="quantity" type="number" min="1" inputmode="numeric" value="1" /></label>
      <label>Apply to
        <select name="scope">
          <option value="selected">Selected permanents</option>
          <option value="all-creatures">All creatures</option>
          <option value="all-permanents">All permanents</option>
          <option value="all-tokens">All tokens</option>
        </select>
      </label>
      <div class="recent-chip-row">
        ${t.map(e=>`<button type="button" data-counter-recent="${$(e)}">${Q(e)}</button>`).join(``)}
      </div>
      <button class="wide">Apply counters</button>
    </form>
  `}function io(e){let t=e.activeSession.commander||{},n=t.damageByOpponent?.opponent||0;return`
    <div class="stacked-form">
      <article class="phase-tracker-card">
        <p class="eyebrow">Commander status</p>
        <h2>${Q(t.name||`No commander selected`)}</h2>
        <strong>Tax ${t.commanderTax||0}</strong>
        <p>Cast count ${t.castCount||0} · Damage ${n}</p>
      </article>
      <div class="button-grid">
        <button data-cast-commander>Cast Commander</button>
        <button data-commander-damage data-delta="1">Damage +1</button>
        <button data-commander-damage data-delta="-1">Damage -1</button>
        <button data-open-commander-quick>Adjust damage</button>
      </div>
    </div>
  `}function ao(e){return e.pendingEffects.length?`
    <section class="pending-strip glass">
      <h2>Pending Effects</h2>
      ${e.pendingEffects.map(e=>`
        <article>
          <strong>${Q(e.sourceName)}</strong>
          <span>${Q(e.status===`pending`?`manual choice required`:e.status)}</span>
          <p>${Q(e.summary||e.effect?.summary||e.effect?.reason||e.effect?.action||`Manual decision required.`)}</p>
          <button data-pending-effect="${e.id}" data-status="resolved">Resolved</button>
          <button data-pending-effect="${e.id}" data-status="skipped">Skipped</button>
          <button data-pending-effect="${e.id}" data-status="ignored">Ignored</button>
        </article>
      `).join(``)}
    </section>
  `:``}function oo(e){return`
    <section class="utility-page glass">
      <h2>Player Profile</h2>
      <p>Name: ${Q(e.player.name)}</p>
      <p>Offline storage is primary. Export this profile to move devices.</p>
      <div class="row">
        <button data-export>Export Profile</button>
        <label class="file-pill">Import Profile<input type="file" accept="application/json" data-import /></label>
      </div>
    </section>
  `}function so(e){return`
    <section class="utility-page glass">
      <h2>Archive</h2>
      <button data-archive-game>Archive Current Game</button>
      ${(e.archives||[]).map(e=>`
        <article class="log-card">
          <strong>${Q(e.commanderName)}</strong>
          <span>${new Date(e.endedAt).toLocaleString()}</span>
          <p>${e.history?.length||0} actions / ${e.effectLog?.length||0} effect logs</p>
        </article>
      `).join(``)||Io(`No archived games yet`)}
    </section>
  `}function co(e,t,n,r,i){let a=Object.values(e.commanders||{});return`
    <section class="utility-page glass">
      <h2>Commander Decks</h2>
      ${Ja(t,n,r,i)}
      ${a.map(e=>`
        <article class="log-card">
          <strong>${Q(e.commanderName)}</strong>
          <span>${e.cards.length} cards / ${Object.keys(e.usage).length} used</span>
          <div class="deck-list">${e.cards.map(e=>`<span>${Q(e.name)}</span>`).join(``)}</div>
        </article>
      `).join(``)||Io(`Choose a commander, then add cards to build a local deck archive.`)}
    </section>
  `}function lo(e){return`
    <section class="utility-page glass">
      <h2>Local Leaderboards</h2>
      <button class="wide" data-open-stats>Open Stats Overlay</button>
      ${Object.entries(e.leaderboards||{}).map(([e,t])=>`
        <article class="log-card">
          <strong>${Q(e)}</strong>
          ${(t||[]).map(e=>`<p>${Q(e.label)}: ${e.value}</p>`).join(``)||`<p>No records yet</p>`}
        </article>
      `).join(``)}
    </section>
  `}function uo(e){let t=Co(e),n=wo(e),r=Ao(e),i=e.settings?.appearance?.compositionMode||`auto`,a=i===`mobile`?`widescreen`:`mobile`,o=i===`mobile`?`Mobile vertical`:`Standard widescreen`,s=e.localAuth||{};return`
    <section class="overlay-backdrop">
      <div class="floating-overlay glass">
        <div class="overlay-header">
          <div>
            <p class="eyebrow">Transparent overlay</p>
            <h2>Game Options</h2>
          </div>
          <button data-close-overlay>Close</button>
        </div>
        <div class="overlay-grid">
          <article class="option-card">
            <h3>Local Login / Profile</h3>
            <p>Status: ${s.mode===`protected`?`Password profile loaded`:`Guest / fresh mode`}${s.hasPassword?` · Password profile available`:``}</p>
            <div class="button-grid">
              <button data-open-profile-page>Open Profile Page</button>
              <button data-guest-mode>Continue as Guest/Fresh</button>
              ${s.mode===`protected`?`<button data-lock-profile>Logout / Lock Profile</button>`:``}
            </div>
            <form data-profile-form class="stacked-form">
              <label>Profile name</label>
              <input name="profileName" value="${$(e.player?.name||`Player`)}" placeholder="Player name" />
              <button class="wide">Save Locally</button>
            </form>
            <form data-create-password-form class="stacked-form">
              <label>Create Password</label>
              <input name="password" type="password" autocomplete="new-password" placeholder="Create local password" />
              <button class="wide">Create / Save Protected Profile</button>
            </form>
            <form data-login-form class="stacked-form">
              <label>Login</label>
              <input name="password" type="password" autocomplete="current-password" placeholder="Local password" />
              <button class="wide">Login and Load Saved Data</button>
            </form>
            <p>Local device protection only. No cloud authentication, and plaintext passwords are never stored.</p>
          </article>
          <article class="option-card">
            <h3>Multiplayer</h3>
            <div class="button-grid">
              <button data-multiplayer-mode="local">Local Multiplayer</button>
              <button data-multiplayer-mode="wifi">Connect via WiFi</button>
              <button data-multiplayer-mode="bluetooth">Bluetooth Placeholder</button>
              <button data-multiplayer-mode="simulated">Simulated Local</button>
              <button data-multiplayer-mode="offline">Disconnect</button>
              <button data-open-simulation-setup>Start Simulation Setup</button>
            </div>
            <p>Mode: ${Q(r.mode)}</p>
            <p>Connected players: ${r.connectedPlayers.length?r.connectedPlayers.map(e=>Q(e.name)).join(`, `):`None`}</p>
            <label class="stacked-form">Room ID
              <input data-mp-setting="multiplayer.roomId" value="${$(r.roomId||`boardstate-room`)}" />
            </label>
            <label class="stacked-form">WiFi Sync URL
              <input data-mp-setting="multiplayer.wsUrl" value="${$(r.wsUrl||`ws://localhost:8787`)}" />
            </label>
            <label class="stacked-form">Role
              <select data-mp-setting="multiplayer.role">
                <option value="player" ${r.role===`player`?`selected`:``}>Player</option>
                <option value="spectator" ${r.role===`spectator`?`selected`:``}>Spectator</option>
              </select>
            </label>
            ${Y(`Spectator view mode`,`multiplayer.spectatorMode`,!!r.spectatorMode)}
            ${Y(`Multiplayer authority confirmations`,`multiplayer.confirmAuthority`,r.confirmAuthority)}
          </article>
          <article class="option-card">
            <h3>Page Customization</h3>
            <p>Wallpaper composition: ${Q(o)}</p>
            <button class="wide" data-setting-button="appearance.compositionMode" data-value="${a}">
              Switch to ${a===`mobile`?`Mobile Vertical`:`Standard Widescreen`}
            </button>
            ${Y(`Life total panel`,`pagePanels.lifeTrackerLife`,n.lifeTrackerLife)}
            ${Y(`Show Profile in Main UI`,`navigation.showProfileInMainUi`,!!e.settings?.navigation?.showProfileInMainUi)}
            ${Y(`Enable Edge Swipe Shortcuts`,`navigation.edgeSwipeShortcuts`,!!e.settings?.navigation?.edgeSwipeShortcuts)}
            <p>Floating mana now lives in the Battlefield tools menu as a floating widget with pin/unpin support.</p>
            ${Y(`Opponent board panel`,`pagePanels.boardOpponent`,n.boardOpponent)}
            ${Y(`Combat controls`,`pagePanels.boardCombat`,n.boardCombat)}
            ${Y(`Board quick tools`,`pagePanels.boardTools`,n.boardTools)}
            ${Y(`Advanced rules helpers`,`pagePanels.advancedRulesHelpers`,n.advancedRulesHelpers)}
            ${Y(`Archive / quick add helpers`,`pagePanels.archiveQuickAdd`,n.archiveQuickAdd)}
            ${Y(`Stats / timer widgets`,`pagePanels.statsTimerWidgets`,n.statsTimerWidgets)}
          </article>
          <article class="option-card">
            <h3>Rules / Accessibility</h3>
            <p>ADHD Mode is a companion assistance layer for reminders and clarity, not official judging or full rules enforcement.</p>
            ${Y(`Helper Sprite`,`helperSprite.enabled`,!!e.settings?.helperSprite?.enabled)}
            <button class="wide" data-helper-remind>Remind me</button>
            ${Y(`ADHD Mode`,`adhdMode.enabled`,!!t.adhdMode?.enabled)}
            ${Y(`ADHD trigger reminders`,`adhdMode.triggerReminders`,!!t.adhdMode?.triggerReminders)}
            ${Y(`ADHD missed trigger reminders`,`adhdMode.missedTriggerReminders`,!!t.adhdMode?.missedTriggerReminders)}
            ${Y(`ADHD targeting reminders`,`adhdMode.targetingReminders`,!!t.adhdMode?.targetingReminders)}
            ${Y(`ADHD layer explanation`,`adhdMode.layerExplanation`,!!t.adhdMode?.layerExplanation)}
            ${Y(`ADHD step-by-step prompts`,`adhdMode.stepByStepPrompts`,!!t.adhdMode?.stepByStepPrompts)}
            ${Y(`ADHD reduced visual noise`,`adhdMode.reducedNoise`,!!t.adhdMode?.reducedNoise)}
            ${Y(`ADHD highlight likely actions`,`adhdMode.highlightLikelyActions`,!!t.adhdMode?.highlightLikelyActions)}
            ${Y(`ADHD resource reminders`,`adhdMode.resourceReminders`,!!t.adhdMode?.resourceReminders)}
            ${Y(`ADHD deterministic auto-assist`,`adhdAutomation`,t.adhdAutomation)}
            ${Y(`Confirm ambiguous effects`,`confirmAmbiguousEffects`,t.confirmAmbiguousEffects)}
            ${Y(`Haptics hooks`,`haptics`,t.haptics)}
            ${Y(`Compact permanent tiles`,`compactTiles`,t.compactTiles)}
            ${Y(`Enable Advanced Gestures`,`gestures.advanced`,!!e.settings?.gestures?.advanced)}
            ${Y(`Focus mode`,`battlefield.focusMode`,!!e.settings?.battlefield?.focusMode)}
          </article>
        </div>
      </div>
    </section>
  `}function fo(e,t){let n=mo(e,w(e)),r=n[t]||n.individual;return`
    <section class="overlay-backdrop">
      <div class="floating-overlay stats-overlay glass">
        <div class="overlay-header">
          <div>
            <p class="eyebrow">Leaderboards linked</p>
            <h2>Stats Overlay</h2>
          </div>
          <button data-close-overlay>Close</button>
        </div>
        <div class="segmented">
          ${[`individual`,`grouped`,`all`,`advanced`].map(e=>`<button class="${t===e?`active`:``}" data-stats-mode="${e}">${Z(e)} Stats</button>`).join(``)}
        </div>
        <div class="stats-grid">
          ${r.map(e=>`
            <article class="stat-card">
              <span>${Q(e.label)}</span>
              <strong>${Q(e.value)}</strong>
            </article>
          `).join(``)}
        </div>
        ${po(e)}
      </div>
    </section>
  `}function po(e){let t=e.statsSync||{},n=t.peers||[];return`
    <article class="option-card stats-sync-card">
      <h3>Personal Stats Auto-Sync</h3>
      <p>Local/network-first sync shares only public stat summaries.</p>
      <button class="wide" data-sync-public-stats>Sync Public Stats Now</button>
      <p>Last sync: ${t.lastSyncedAt?new Date(t.lastSyncedAt).toLocaleString():`Never`}</p>
      <div class="deck-list">
        ${n.map(e=>`<span>${Q(e.name)} · Board ${e.boardSize}</span>`).join(``)||`<span>No synced players yet</span>`}
      </div>
    </article>
  `}function mo(e,t){let n=e.activeSession,r=[...n.battlefield.player,...n.battlefield.opponent].filter(e=>e.isCreature),i=Object.values(e.commanders||{}),a=Math.max(1,Date.now()-n.timer.gameStartedAt),o=a/Math.max(1,n.turn),s=i.reduce((e,t)=>e+(t.stats?.wins||0),0),c=i.reduce((e,t)=>e+(t.stats?.losses||0),0),l=r.map(e=>({name:e.name,damage:Math.max(0,Number(e.currentPower)||0)*(e.quantity||1)})).sort((e,t)=>t.damage-e.damage)[0],u=i.flatMap(e=>e.cards?.filter(t=>!e.usage?.[t.name]).map(e=>e.name)||[]).slice(0,4),d=[{label:`Games played`,value:t.gamesPlayed},{label:`Actions this game`,value:t.actionsThisGame},{label:`Highest life`,value:t.highestLife},{label:`Floating mana`,value:t.manaFloating}],f=[{label:`Board size`,value:t.currentBoardSize},{label:`Largest token army`,value:t.largestTokenArmy},{label:`Triggers resolved`,value:t.triggersResolved},{label:`Commander decks`,value:t.commanderCount}],p=[{label:`Average turn time`,value:jo(o)},{label:`Positive time`,value:jo(a*.55)},{label:`Negative time`,value:jo(a*.45)},{label:`Median turn time`,value:jo(o)},{label:`Win/loss record`,value:`${s}-${c}`},{label:`Commander-specific win/loss`,value:i.map(e=>`${e.commanderName}: ${e.stats?.wins||0}-${e.stats?.losses||0}`).join(` / `)||`No commander games yet`},{label:`Highest average damaging creature`,value:l?`${l.name} (${l.damage})`:`No creatures yet`},{label:`Shortest-lived permanent`,value:`Not enough removal history yet`},{label:`Low/no board interaction cards`,value:u.join(`, `)||`No deck data yet`},{label:`Multiplayer win/loss comparison`,value:Ao(e).connectedPlayers.length?`Simulated comparison active`:`No connected players`}];return{individual:d,grouped:f,advanced:p,all:[...d,...f,...p]}}function ho(e){let t=X(e.activeSession),n=(e.activeSession.eventHistory||[]).slice(0,8),r=bo(e),i=e.activeSession.triggerQueue||[];return t.length?`
    <div class="stacked-form">
      ${t.map(t=>`
        <article class="log-card">
          <strong>${Q(t.name)}</strong>
          <span>${Q(t.typeLine)}</span>
          ${go(t,e)}
          ${r.enabled?`
            <div class="inspect-reminder-block">
              <strong>ADHD reminders</strong>
              <p>${Q(_o(e,t)||`No active ADHD reminders for this object.`)}</p>
              <p>${Q(vo(i,t.id)||`No unresolved trigger chain links.`)}</p>
            </div>
          `:``}
        </article>
      `).join(``)}
      <article class="log-card">
        <strong>Trigger History</strong>
        ${n.map(e=>`<p>${Q(e.eventType)} · ${new Date(e.timestamp).toLocaleTimeString()}</p>`).join(``)||`<p>No recent events</p>`}
      </article>
    </div>
  `:`<p class="eyebrow">Select one or more permanents to inspect details and active modifications.</p>`}function go(e,t){let n=Object.entries(e.counters||{}).filter(([,e])=>Number(e)>0).map(([e,t])=>`${e} ${t}`),r=e.layerBreakdown||[],i=r.filter(e=>e.operation===`set-type`),a=r.filter(e=>e.operation===`set-color`),o=r.filter(e=>e.operation===`add-keywords`),s=r.filter(e=>e.operation===`add-pt`||e.operation===`set-base-pt`),c=(t.activeSession.triggerQueue||[]).filter(t=>t.sourceId===e.id&&t.status===`pending`),l=c.slice(0,4).map(e=>`<button data-trigger-inspect="${$(e.id)}">Inspect ${Q(e.id)}</button>`).join(``),u=e.relationships?.copiedFromId||e.metadata?.copiedFrom||(e.isCopy?`Copy source tracked in token metadata`:`None`);return`
    <div class="layer-inspector-grid">
      <p><strong>Base:</strong> ${e.basePower}/${e.baseToughness} · MV ${e.manaValue||0}</p>
      <p><strong>Copied values:</strong> ${Q(u)}</p>
      <p><strong>Control:</strong> Owner ${Q(e.owner||`player`)} · Controller ${Q(e.controller||`player`)}</p>
      <p><strong>Type changes:</strong> ${i.length?i.map(e=>`L${e.layer}:${e.operation}`).join(` · `):`No type overrides`}</p>
      <p><strong>Color changes:</strong> ${a.length?a.map(e=>`L${e.layer}:${e.operation}`).join(` · `):`No color overrides`}</p>
      <p><strong>Ability changes:</strong> ${o.length?o.map(e=>`${e.keywordDelta?.length?e.keywordDelta.join(`, `):`L${e.layer}:${e.operation}`}`).join(` · `):`No ability overrides`}</p>
      <p><strong>Modifiers:</strong> ${s.length?s.map(e=>{let t=Number(e.powerDelta||0),n=Number(e.toughnessDelta||0);return`L${e.layer}:${e.operation} (${t>=0?`+`:``}${t}/${n>=0?`+`:``}${n})`}).join(` · `):`No active stat modifiers`}</p>
      <p><strong>Counters:</strong> ${n.length?n.map(Q).join(` / `):`No counters`}</p>
      <p><strong>Final stats:</strong> ${e.isCreature?`${e.currentPower}/${e.currentToughness}`:`Non-creature permanent`}</p>
      <p><strong>Oracle text:</strong> ${Q(e.rulesText||e.oracleText||`No rules text`)}</p>
      <p><strong>Unresolved trigger links:</strong> ${c.length?c.map(e=>`${e.id} (${e.eventType})`).join(`, `):`None`}</p>
      ${l?`<div class="row mini">${l}</div>`:``}
    </div>
  `}function _o(e,t){let n=e.activeSession,r=[],i=bo(e);return i.enabled?(t?.summoningSick&&r.push(`Summoning sickness reminder`),(n.triggerQueue||[]).some(e=>e.status===`pending`)&&r.push(`Resolve pending trigger queue entries`),(n.pendingEffects||[]).some(e=>e.status===`pending`)&&r.push(`Manual effect confirmations pending`),(n.pendingEffects||[]).some(e=>e.status===`ignored`)&&r.push(`Ignored manual effects still need review`),n.manaPool&&Object.values(n.manaPool).some(e=>Number(e)>0)&&r.push(`Floating mana still available`),Number(n.commander?.damageByOpponent?.opponent||0)>0&&r.push(`Commander damage tracker has active value`),Object.values(n.playerCounters||{}).some(e=>Number(e)>0)&&r.push(`Player counters are non-zero`),i.phaseActionReminders&&r.push(`Phase action check: ${f[n.phaseIndex]||`Unknown phase`}`),r.join(` · `)):``}function vo(e=[],t=``){let n=e.filter(e=>e.status===`pending`&&(!t||e.sourceId===t));return n.length?n.map(e=>`${e.chainId}:${e.eventType}`).join(` · `):``}function yo(e,t,n={}){let r=e.activeSession||{},i=bo(e),a=n.activeToolPanel===`inspect`||e.settings?.battlefield?.detailMode===`inspect`||t===`leaderboards`&&n.statsOpen,o=!!(e.settings?.battlefield?.focusMode&&(r.selectedIds||[]).length),s=!!(r.selectedIds||[]).length||!!n.toolMenuOpen||!!n.activeToolPanel||!!n.floatingManaOpen||!!n.utilityDockOpen||!!n.activeUtilityPanel||!!n.quickPanelOpen||!!n.optionsOpen||!!n.statsOpen,c=i.enabled?`adhd`:a?`inspect`:o?`focus`:s?`active`:`passive`;return{current:c,passive:c===`passive`,active:c===`active`,focus:c===`focus`,inspect:c===`inspect`,adhd:c===`adhd`}}function bo(e){let t=e.settings||{},n={enabled:!1,triggerReminders:!0,missedTriggerReminders:!0,legalityHints:!0,targetingReminders:!0,stackExplanation:!0,layerExplanation:!0,triggerChainView:!0,replayDebugInfo:!0,stateInspector:!0,focusedGuidance:!0,reducedNoise:!0,highlightLikelyActions:!0,phaseActionReminders:!0,unresolvedReminders:!0,resourceReminders:!0,stepByStepPrompts:!1},r=!!t.adhdAutomation;return{...n,...t.adhdMode||{},enabled:!!(t.adhdMode?.enabled??r)}}function xo(e,t,n){let r=bo(e);if(!r.enabled)return``;let i=e.activeSession,a=X(i)[0]||null,o=i.triggerQueue||[],s=o.filter(e=>e.status===`pending`),c=o.filter(e=>e.status===`skipped`||e.status===`delayed`),l=(i.pendingEffects||[]).filter(e=>e.status===`pending`),u=(i.pendingEffects||[]).filter(e=>e.status===`ignored`),d=r.highlightLikelyActions?ra(e).slice(0,4):[],p=f[i.phaseIndex]||`Unknown`;return`
    <section class="adhd-assist-panel glass" data-no-swipe data-page="${$(t)}" data-ui-layer="${$(n)}">
      <div class="overlay-header compact">
        <div>
          <p class="eyebrow">ADHD Mode</p>
          <h2>Assistance Layer</h2>
        </div>
        <span class="eyebrow">${Q(p)} · Turn ${i.turn}</span>
      </div>
      <p>${Q([r.focusedGuidance?`Current focus: ${a?a.name:`Select a permanent or player tool`}`:``,r.phaseActionReminders?`Phase reminder: resolve actions before leaving ${p}`:``].filter(Boolean).join(` · `)||`Assistance layer active.`)}</p>
      <div class="adhd-assist-grid">
        ${r.triggerReminders?`<article><strong>Trigger reminders</strong><p>${s.length} unresolved</p></article>`:``}
        ${r.unresolvedReminders?`<article><strong>Manual choices</strong><p>${l.length} pending Â· ${u.length} ignored</p></article>`:``}
        ${r.missedTriggerReminders?`<article><strong>Missed trigger reminders</strong><p>${c.length} flagged</p></article>`:``}
        ${r.resourceReminders?`<article><strong>Resource reminders</strong><p>Mana ${Object.values(i.manaPool||{}).reduce((e,t)=>e+Number(t||0),0)} · Counters ${Object.values(i.playerCounters||{}).reduce((e,t)=>e+Number(t||0),0)}</p></article>`:``}
        ${r.replayDebugInfo?`<article><strong>Action / replay debug</strong><p>Actions ${(i.actionHistory||[]).length} · Undo ${(i.undoStack||[]).length} · Redo ${(i.redoStack||[]).length}</p></article>`:``}
      </div>
      ${r.stackExplanation&&s.length?`<div class="adhd-mini-list"><strong>Stack explanation</strong>${s.slice(0,4).map(e=>`<p>${Q(e.sourceName)} · ${Q(e.eventType)} · Chain ${Q(e.chainId)}</p>`).join(``)}</div>`:``}
      ${r.layerExplanation&&a?`<div class="adhd-mini-list"><strong>Modifier / layer explanation</strong><p>${Q((a.layerBreakdown||[]).map(e=>`L${e.layer}:${e.operation}`).join(` · `)||`No active modifiers`)}</p></div>`:``}
      ${r.stateInspector&&a?`<div class="adhd-mini-list"><strong>Battlefield state inspector</strong><p>${Q(`${a.name} · ${a.typeLine} · ${a.currentPower}/${a.currentToughness}`)}</p><p>${Q(a.rulesText||a.oracleText||`No oracle text available`)}</p></div>`:``}
      ${r.targetingReminders&&a?`<div class="adhd-mini-list"><strong>Targeting reminders</strong><p>${Q(a.isAura||a.isEquipment?`Attachment target check recommended.`:a.isCreature?`Attack/block legality check recommended.`:`Confirm target selectors before resolving effects.`)}</p></div>`:``}
      ${r.legalityHints&&e.activeSession.commander?.name?`<div class="adhd-mini-list"><strong>Legality hints</strong><p>Commander identity: ${Q((e.activeSession.commander.colorIdentity||[]).join(``)||`Colorless`)}</p></div>`:``}
      ${r.highlightLikelyActions&&d.length?`<div class="adhd-mini-list"><strong>Likely next actions</strong>${d.map(e=>`<p>${Q(e.label)} · ${Q(e.detail)}</p>`).join(``)}</div>`:``}
      ${r.stepByStepPrompts?`<div class="adhd-mini-list"><strong>Step-by-step prompt</strong><p>1) Resolve pending triggers 2) Confirm modifiers 3) Update combat declarations 4) Advance phase</p></div>`:``}
    </section>
  `}function So(e,t){return!e.settings?.helperSprite?.enabled||!t?``:`
    <section class="helper-sprite-widget glass" data-no-swipe>
      <button class="helper-sprite-avatar" data-helper-dismiss title="Dismiss helper sprite">✨</button>
      <button class="helper-sprite-bubble" data-helper-open>
        <strong>Helper Sprite</strong>
        <span>${Q(t.text)}</span>
      </button>
    </section>
  `}function Y(e,t,n,r=!0){let i=r===!0?`true`:r;return`
    <label class="toggle-row">
      <span>${Q(e)}</span>
      <input type="checkbox" data-setting-toggle="${$(t)}" ${n?`checked`:``} value="${$(i)}" />
    </label>
  `}function Co(e){let t=bo(e);return{adhdAutomation:t.enabled,adhdMode:t,helperSprite:{enabled:!1,remindersAtUpkeep:!0,...e.settings?.helperSprite||{}},confirmAmbiguousEffects:!0,haptics:!1,compactTiles:!0,gestures:{advanced:!0},...e.settings||{}}}function wo(e){return{lifeTrackerLife:!0,lifeTrackerMana:!0,lifeTrackerTools:!0,boardOpponent:!0,boardCombat:!0,boardTools:!0,advancedRulesHelpers:!0,archiveQuickAdd:!0,statsTimerWidgets:!0,...e.settings?.pagePanels||{}}}function To(e){return e.settings?.navigation?.showProfileInMainUi?[`life`,`battlefield`,`profile`,`archive`,`decks`,`leaderboards`]:[`life`,`battlefield`,`archive`,`decks`,`leaderboards`]}function X(e){let t=new Set(e.selectedIds||[]);return t.size?[...e.battlefield.player,...e.battlefield.opponent].filter(e=>t.has(e.id)):[]}function Eo(e,t=``){if(t===`player`)return`player`;let n=X(e);return n.length?n.some(e=>(Number(e.quantity)||1)>1)?`stack`:n.some(e=>e.isCommander)?`commander`:n.every(e=>e.isToken)?`token`:n.every(e=>e.isCreature)?`creature`:`permanent`:`empty`}function Do(e){return{kind:e.kind,value:e.value,scopes:{...e.scopes}}}function Oo(e){if(!e||e.kind===`none`)return`+1`;let t=Number(e.value)||1;return`${t>0?`+`:``}${t}`}function ko(e){let t=e?.scopes||{},n=[t.life?`Life`:``,t.poison?`Poison`:``,t.energy?`Energy`:``,t.experience?`XP`:``,t.tickets?`Tickets`:``,t.commander?`Commander`:``].filter(Boolean);return n.length?n.join(` / `):`Long press`}function Ao(e){return{mode:`offline`,connectedPlayers:[],authorityMode:`confirm`,confirmAuthority:!0,bluetoothReady:!1,wifiReady:!0,roomId:`boardstate-room`,wsUrl:`ws://localhost:8787`,role:`player`,spectatorMode:!1,...e.settings?.multiplayer||{}}}function jo(e){let t=Math.max(0,Math.round(e/1e3)),n=Math.floor(t/60),r=t%60;return`${n}m ${String(r).padStart(2,`0`)}s`}function Mo(e){return e===`true`?!0:e===`false`?!1:e}function Z(e){return String(e||``).replace(/^\w/,e=>e.toUpperCase())}function No(e){return{W:`White`,U:`Blue`,B:`Black`,R:`Red`,G:`Green`,C:`Colorless`,Generic:`Generic`}[e]||e}function Po(e){return e===`life`?`Life Tracker`:Z(e)}function Fo(e){let t=new Blob([yi(e)],{type:`application/json`}),n=URL.createObjectURL(t),r=document.createElement(`a`);r.href=n,r.download=`boardstate-profile-${new Date().toISOString().slice(0,10)}.json`,r.click(),URL.revokeObjectURL(n)}function Io(e){return`<p class="empty">${Q(e)}</p>`}function Q(e){return String(e||``).replace(/[&<>"']/g,e=>({"&":`&amp;`,"<":`&lt;`,">":`&gt;`,'"':`&quot;`,"'":`&#039;`})[e])}function $(e){return Q(e)}var Lo=document.querySelector(`#app`),Ro=Ni();ha(Lo,Ro),Ro.init();