# Deck Generation Public Facade 不参与内部调用链

Deck Generation exposes a stable app-facing public facade, but internal workflow modules should not call back through that facade. Decide that UI and other feature modules import public APIs from `deck-generation/index.ts`, while modules inside `deck-generation` import concrete internal workflow modules directly, such as Deck Refinement calling Deck Generation workflow through its implementation module rather than through the public facade.

This rejects using `index.ts` as an internal service locator. The trade-off is that internal modules know the specific workflow module they need, but the dependency direction stays acyclic and the public facade remains a stable export boundary instead of owning orchestration decisions.
