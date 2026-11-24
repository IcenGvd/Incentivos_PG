# Incentivos P&G · Vega

Tablero de incentivos P&G (Venta, Cobertura y Ejecución).

- `index.html` — el tablero.
- `data/state.json` — los datos que lee el tablero (los genera GitHub).
- `entrada/` — los archivos que subes desde tu PC (comprimidos). Se crea sola con la primera subida.
- `scripts/procesar.js` — el cálculo (el mismo del tablero). Corre en los servidores de GitHub, no en tu PC.
- `.github/workflows/actualizar.yml` — el proceso automático: cada vez que subes archivos, los procesa, guarda `data/state.json` y publica la página.

En tu PC solo necesitas **Python**: ver la carpeta `en-tu-pc` (`actualizar.bat` y `subir.py`).
