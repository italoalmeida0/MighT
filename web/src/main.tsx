import { render } from 'solid-js/web';
import '../style.tailwindcss.css';
import { App } from './App';

const root = document.getElementById('app');

if (root) {
  render(() => <App />, root);
}
