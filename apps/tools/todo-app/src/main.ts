import './style.css';
import { TodoApp } from './app.ts';

const root = document.getElementById('app')!;
const app = new TodoApp(root);
app.init().catch(console.error);