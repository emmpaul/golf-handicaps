/** Modèle de vision utilisé pour compléter les cartes (design, décision 3). */
export const AI_MODEL = "claude-opus-5-5";

/** Borne des tokens de sortie d'un appel, réflexion comprise. */
export const AI_MAX_TOKENS = 4000;

/**
 * Tokens d'entrée du pire cas : image de 1568×800 (≈ 1 700), prompt système et
 * schéma de sortie que l'API injecte. Mesuré à 2 919 tokens sur une vraie carte.
 */
export const AI_MAX_INPUT_TOKENS = 3500;
