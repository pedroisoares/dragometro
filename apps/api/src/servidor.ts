import { criarApp } from './app';

const porta = Number(process.env.PORT ?? 3333);
const app = await criarApp({ logger: true });
await app.listen({ port: porta, host: '0.0.0.0' });
