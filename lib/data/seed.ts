// Selector de datos semilla por tenant.
// El contenido real vive en lib/tenants/seeds/<tenant>.ts; aquí solo se reexporta
// el del tenant ACTIVO para que el resto del código (provider, componentes) siga
// importando `ME`, `departments`, etc. sin cambios.
//
// Se evalúa al cargar el módulo: en el cliente lee el tenant de localStorage (que
// el login fijó antes de recargar); en SSR cae al tenant por defecto.

import { activeTenant } from "@/lib/tenants/active";

const seed = activeTenant().seed;

export const ME = seed.ME;
export const departments = seed.departments;
export const staff = seed.staff;
export const contacts = seed.contacts;
export const conversations = seed.conversations;
export const messages = seed.messages;
export const internalChannels = seed.internalChannels;
export const internalMessages = seed.internalMessages;
export const socialPosts = seed.socialPosts;
export const socialStats = seed.socialStats;
export const metrics = seed.metrics;
