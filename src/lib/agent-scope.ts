/** Which offer set the live browser agent should verify. */
export type AgentScope = "generic" | "branded" | "all";

export const AGENT_SCOPE_LABEL: Record<AgentScope, string> = {
  generic: "Subsidised generic substitutes",
  branded: "Branded express medicines",
  all: "All medicine offers",
};

export const AGENT_SCOPE_SHORT: Record<AgentScope, string> = {
  generic: "generics",
  branded: "branded",
  all: "all offers",
};
