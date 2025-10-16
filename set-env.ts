import * as fs from 'fs';
import * as dotenv from 'dotenv';

// Detectar entorno: development o production
const environment = process.env.NODE_ENV || 'development';

// Cargar el archivo .env correspondiente
const envFile = environment === 'production' ? '.env.production' : '.env.development';
dotenv.config({ path: envFile });

console.log(`✅ Generando environment para entorno: ${environment}`);

// Directorio de salida
const targetDir = './src/environments';

// Crear directorio si no existe
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir);
}

const envConfigFile = `
export const environment = {
  production: ${environment === 'production'},
  firebase: {
    apiKey: '${process.env.NG_APP_FIREBASE_API_KEY}',
    authDomain: '${process.env.NG_APP_FIREBASE_AUTH_DOMAIN}',
    projectId: '${process.env.NG_APP_FIREBASE_PROJECT_ID}',
    storageBucket: '${process.env.NG_APP_FIREBASE_STORAGE_BUCKET}',
    messagingSenderId: '${process.env.NG_APP_FIREBASE_MESSAGING_SENDER_ID}',
    appId: '${process.env.NG_APP_FIREBASE_APP_ID}'
  }
};
`;

// Archivo destino según entorno
const targetPath =
  environment === 'production'
    ? `${targetDir}/environment.production.ts`
    : `${targetDir}/environment.development.ts`;

// También lo copiamos a environment.ts para que Angular siempre lea uno
fs.writeFileSync(`${targetDir}/environment.ts`, envConfigFile);
fs.writeFileSync(targetPath, envConfigFile);

console.log(`🌍 Archivo environment.ts (${environment}) generado con éxito.`);
