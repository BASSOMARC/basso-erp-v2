'use client';
import { useSyncExternalStore } from 'react';
import { sb } from './supabase';

export type Lang = 'es' | 'fr';
const D: Record<string, { es: string; fr: string }> = {
  loading: { es: 'Cargando…', fr: 'Chargement…' },
  myDays: { es: 'Mis jornadas', fr: 'Mes journées' },
  pointage: { es: 'Fichaje', fr: 'Pointage' },
  changePwd: { es: 'Cambiar contraseña', fr: 'Changer le mot de passe' },
  logout: { es: 'Salir', fr: 'Déconnexion' },
  pwdPrompt: { es: 'Nueva contraseña (mínimo 10 caracteres):', fr: 'Nouveau mot de passe (10 caractères minimum) :' },
  pwdShort: { es: 'Demasiado corta', fr: 'Trop court' },
  pwdFail: { es: 'No se pudo cambiar: ', fr: 'Échec : ' },
  pwdOk: { es: 'Contraseña cambiada ✔', fr: 'Mot de passe modifié ✔' },
  noPerm: { es: 'Tu usuario no tiene permisos. Habla con un administrador.', fr: "Votre compte n'a pas les droits nécessaires. Contactez un administrateur." },
  loginSub: { es: 'Acceso al sistema', fr: 'Accès au système' },
  email: { es: 'Correo', fr: 'E-mail' },
  password: { es: 'Contraseña', fr: 'Mot de passe' },
  enter: { es: 'Entrar', fr: 'Se connecter' },
  entering: { es: 'Entrando…', fr: 'Connexion…' },
  badLogin: { es: 'Usuario o contraseña incorrectos', fr: 'Identifiant ou mot de passe incorrect' },
  // incidencias
  t_accidente: { es: 'Accidente', fr: 'Accident' }, t_retraso: { es: 'Retraso', fr: 'Retard' }, t_material: { es: 'Falta de material', fr: 'Manque de matériel' },
  t_clima: { es: 'Clima', fr: 'Météo' }, t_cliente: { es: 'Cliente', fr: 'Client' }, t_otra: { es: 'Otra', fr: 'Autre' },
  incDescribe: { es: 'Cuenta brevemente qué ha pasado', fr: "Décrivez brièvement ce qui s'est passé" },
  notSaved: { es: 'No se guardó: ', fr: 'Non enregistré : ' },
  noReply: { es: 'sin respuesta', fr: 'pas de réponse' },
  sentAdmin: { es: 'enviada al administrador', fr: "envoyée à l'administrateur" }, resolved: { es: 'resuelta', fr: 'résolue' },
  incSent: { es: 'Reporte enviado ✔ El administrador lo verá.', fr: "Signalement envoyé ✔ L'administrateur le verra." },
  reportBtn: { es: '⚠ Reportar un problema', fr: '⚠ Signaler un problème' },
  whatHappened: { es: '¿Qué ha pasado?', fr: "Que s'est-il passé ?" },
  withWhom: { es: '¿Con quién? (opcional)', fr: 'Avec qui ? (facultatif)' },
  nobody: { es: '— nadie en concreto —', fr: '— personne en particulier —' },
  tellIt: { es: 'Cuéntalo con tus palabras', fr: 'Racontez-le avec vos mots' },
  incPh: { es: 'Ej. se rompió una tijera, llovió desde las 11…', fr: 'Ex. un sécateur cassé, pluie à partir de 11 h…' },
  sendReport: { es: 'Enviar reporte', fr: 'Envoyer le signalement' }, cancel: { es: 'Cancelar', fr: 'Annuler' },
  // jornada
  byHour: { es: 'Trabajo por horas', fr: "Travail à l'heure" }, byVine: { es: 'Trabajo por cepa', fr: 'Travail au pied' }, byKg: { es: 'Trabajo por kg', fr: 'Travail au kg' },
  chief: { es: 'Jefe', fr: "Chef d'équipe" },
  st_planificada: { es: 'por hacer', fr: 'à faire' }, st_fichada: { es: 'enviada', fr: 'envoyée' }, st_validada: { es: 'validada', fr: 'validée' },
  doneValidated: { es: 'Jornada validada ✔', fr: 'Journée validée ✔' }, doneSent: { es: 'Jornada enviada ✔', fr: 'Journée envoyée ✔' },
  person: { es: 'persona', fr: 'personne' }, people: { es: 'personas', fr: 'personnes' },
  pendingValidate: { es: ' · pendiente de validar por el administrador. Si corriges algo, pulsa Guardar.', fr: " · en attente de validation par l'administrateur. Pour corriger, appuyez sur Enregistrer." },
  askAdminFix: { es: ' · para corregir algo, avisa a un administrador.', fr: ' · pour corriger, prévenez un administrateur.' },
  draftBack: { es: 'Recuperé lo que habías escrito y no estaba guardado. Revísalo y pulsa Guardar.', fr: "J'ai récupéré ce que vous aviez saisi sans enregistrer. Vérifiez et appuyez sur Enregistrer." },
  s_att: { es: 'Asistencia', fr: 'Présence' }, s_hours: { es: 'Horas', fr: 'Heures' }, s_vines: { es: 'Cepas', fr: 'Pieds' }, s_kg: { es: 'Kg', fr: 'Kg' }, s_none: { es: 'Sin cantidad', fr: 'Sans quantité' },
  allPresent: { es: '✓ Todos presentes · 7 h', fr: '✓ Tous présents · 7 h' },
  addedByYou: { es: ' · añadido por ti', fr: ' · ajouté par vous' }, remove: { es: 'Quitar', fr: 'Retirer' },
  present: { es: '✓ Presente', fr: '✓ Présent' }, absent: { es: '✗ Ausente', fr: '✗ Absent' },
  hours: { es: 'Horas', fr: 'Heures' }, role: { es: 'Función', fr: 'Fonction' }, porteur: { es: 'Porteur', fr: 'Porteur' }, cutter: { es: 'Cortador', fr: 'Coupeur' },
  extraH: { es: 'h extra', fr: 'h supp.' },
  someoneElse: { es: '+ Ha venido otra persona…', fr: '+ Une autre personne est venue…' }, add: { es: 'Añadir', fr: 'Ajouter' },
  vinesToday: { es: 'Cepas hechas hoy por todo el equipo', fr: "Pieds faits aujourd'hui par toute l'équipe" }, kgToday: { es: 'Kg hechos hoy por todo el equipo', fr: "Kg faits aujourd'hui par toute l'équipe" },
  qtyOpt: { es: 'Cantidad realizada (opcional)', fr: 'Quantité réalisée (facultatif)' }, unit: { es: 'Unidad', fr: 'Unité' }, vinesU: { es: 'cepas', fr: 'pieds' },
  notes: { es: 'Notas de la jornada (opcional)', fr: 'Notes de la journée (facultatif)' },
  notesPh: { es: 'Ej. parcela terminada, falta la fila 12…', fr: 'Ex. parcelle terminée, il reste le rang 12…' },
  allReady: { es: '✓ Todo listo', fr: '✓ Tout est prêt' },
  presents: { es: 'presentes', fr: 'présents' }, absents: { es: 'ausentes', fr: 'absents' },
  save: { es: 'Guardar', fr: 'Enregistrer' }, sendDay: { es: 'Fichar jornada', fr: 'Valider la journée' },
  missConfirm: { es: 'Faltan {n} por confirmar', fr: 'Il reste {n} à confirmer' }, missWorker: { es: 'Añade al menos un trabajador', fr: 'Ajoutez au moins un ouvrier' },
  missHours: { es: 'Faltan las horas de algún presente', fr: "Il manque les heures d'un présent" },
  missQtyV: { es: 'Falta el total de cepas del equipo', fr: "Il manque le total de pieds de l'équipe" }, missQtyK: { es: 'Falta el total de kg del equipo', fr: "Il manque le total de kg de l'équipe" },
  savedOk: { es: 'Guardado y verificado en el servidor ✔', fr: 'Enregistré et vérifié sur le serveur ✔' },
  srvMismatch: { es: 'El servidor no devolvió los mismos valores que enviaste. NO se da por guardado. Avisa a un administrador.', fr: "Le serveur n'a pas renvoyé les mêmes valeurs. NON enregistré. Prévenez un administrateur." },
  qtyMismatch: { es: 'La cantidad no se guardó correctamente.', fr: "La quantité n'a pas été enregistrée correctement." },
  notesMismatch: { es: 'Las observaciones no se guardaron correctamente.', fr: "Les notes n'ont pas été enregistrées correctement." },
  needPres: { es: 'Faltan {n} trabajador(es) por marcar como presentes o ausentes.', fr: "Il reste {n} ouvrier(s) à marquer présent ou absent." },
  presNoHours: { es: 'Hay trabajadores presentes sin horas.', fr: "Des ouvriers présents n'ont pas d'heures." },
  needQtyV: { es: 'Esta jornada es por cepa: indica el total realizado.', fr: 'Cette journée est au pied : indiquez le total réalisé.' }, needQtyK: { es: 'Esta jornada es por kg: indica el total realizado.', fr: 'Cette journée est au kg : indiquez le total réalisé.' },
  cantSend: { es: 'No se pudo fichar: ', fr: "Impossible de valider : " }, noChanges: { es: 'sin cambios', fr: 'aucun changement' },
  sentMsg: { es: 'Jornada fichada ✔ Pendiente de validación', fr: 'Journée validée ✔ En attente de validation' },
  yesterday: { es: 'Ayer', fr: 'Hier' }, today: { es: 'Hoy', fr: "Aujourd'hui" }, tomorrow: { es: 'Mañana', fr: 'Demain' }, otherDay: { es: 'Otro día', fr: 'Autre jour' },
  noDays: { es: 'No tienes jornadas para este día.', fr: "Vous n'avez pas de journée ce jour-là." },
  noDaysSub: { es: 'Cuando el administrador te asigne una, aparecerá aquí con tu equipo.', fr: "Quand l'administrateur vous en attribuera une, elle apparaîtra ici avec votre équipe." },
};
let lang: Lang = 'es';
try { const g = typeof localStorage !== 'undefined' ? localStorage.getItem('idioma') : null; if (g === 'fr' || g === 'es') lang = g; } catch {}
const subs = new Set<() => void>();
export function aplicarIdioma(l: Lang) { if (l === lang) return; lang = l; try { localStorage.setItem('idioma', l); } catch {} subs.forEach(f => f()); }
export async function cambiarIdioma(l: Lang) { aplicarIdioma(l); try { await sb.rpc('set_mi_idioma', { p_idioma: l }); } catch {} }
export function tr(l: Lang, k: string, p?: Record<string, string | number>) { let s = D[k]?.[l] ?? D[k]?.es ?? k; if (p) for (const [a, b] of Object.entries(p)) s = s.replace('{' + a + '}', String(b)); return s; }
export function useT() {
  const l = useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => lang, () => 'es' as Lang);
  return { lang: l, t: (k: string, p?: Record<string, string | number>) => tr(l, k, p) };
}
