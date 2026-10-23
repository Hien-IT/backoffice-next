// Spec 020 (D-139): `express4` is express@4.21.2 under an npm alias, the version DR 11.17.4 gives endpoint
// extensions. It ships no types; the Express 5 types cover what the endpoint app uses (app, Router, settings).
declare module 'express4' {
	import express from 'express';
	export default express;
}
