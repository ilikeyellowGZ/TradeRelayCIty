# Botify frontend preview

Responsive, presentation-only Botify trading dashboard. It contains illustrative interface values only; it has no authentication, broker integration, trading controls, API, database or persistent storage. Bebas Neue and Roboto load from Google Fonts, with local system fallbacks.

## Run locally

```sh
npm install
npm run dev
```

Create the production bundle with `npm run build`; use `npm run preview` to serve the built files locally. React Grab, React Scan and React Doctor are development tools; React Grab and React Scan load only while Vite is in development mode.

## Oracle hosting

The `dist/` folder is a static website bundle. It can be served by Nginx on an Oracle Linux VM. Before deployment, choose an OCI home region, create an Always Free eligible Ampere A1 VM if capacity is available, generate an SSH key pair and decide whether you want to use a custom domain. Configure HTTPS before sharing the site. Oracle's Always Free quota is limited and can be reclaimed when an instance meets its idle criteria.

This covers the frontend preview only. It does not host the full trading system. The MT5 Python integration described in the source prompt requires a Windows MT5 environment; that is separate from this ARM Linux static web host and is not included in this frontend build or promised to fit Oracle Always Free.
