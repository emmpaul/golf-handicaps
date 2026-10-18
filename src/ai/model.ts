/** Modèle de vision utilisé pour compléter les cartes (design, décision 3). */
export const AI_MODEL = "claude-opus-5-5";

/** Borne des tokens de sortie d'un appel, réflexion comprise. */
export const AI_MAX_TOKENS = 4000;

/**
 * Tokens d'entrée du pire cas : image de 1568×800 (≈ 1 700), prompt système et
 * schéma de sortie que l'API injecte. Mesuré à 2 919 tokens sur une vraie carte.
 */
export const AI_MAX_INPUT_TOKENS = 3500;

/** Borne des tokens de sortie d'un appel de cadrage (4 coins), réflexion comprise. */
export const LOCATE_MAX_TOKENS = 2000;

/**
 * Tokens d'entrée du pire cadrage : photo réduite à 1568 px sur le grand côté
 * (≈ 1 600 pour 1568×1176), prompt système et schéma des coins. Mesuré à 3 301 tokens
 * sur la photo de référence.
 */
export const LOCATE_MAX_INPUT_TOKENS = 4000;
