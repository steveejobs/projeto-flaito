/**
 * Logger Wrapper
 * Impede que logs sensíveis sejam gerados em produção silenciosamente, 
 * diminuindo o risco de vazamento de dados ao usar o DevTools.
 */

const isDev = import.meta.env.DEV;

export const logger = {
    log: (...args: any[]) => {
        if (isDev) {
            console.log(...args);
        }
    },
    warn: (...args: any[]) => {
        if (isDev) {
            console.warn(...args);
        }
    },
    error: (...args: any[]) => {
        // Errors should probably be reported to a monitoring service like Sentry in production
        if (isDev) {
            console.error(...args);
        }
    },
    info: (...args: any[]) => {
        if (isDev) {
            console.info(...args);
        }
    },
    debug: (...args: any[]) => {
        if (isDev) {
            console.debug(...args);
        }
    }
};
