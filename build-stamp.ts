// A one-line comment at the top of every built file naming the commit it came
// from. Shared by all three vite configs so the three stable URLs are stamped
// the same way.
//
// It exists because a deploy of these files is only finished once Cloudflare's
// edge is serving them, and there was no way to ask. Comparing the served
// bytes to the built ones looks like the obvious check and is not one: the
// minifier's mangled names are not stable run to run, so two builds of the
// same commit differ by hundreds of bytes of `Ot` vs `Bt` while being the same
// program. That check shipped, and failed on a deploy that had in fact worked.
//
// A stamp is the honest version of the same question. It is one grep from CI,
// and in the field it turns "which build is this visitor running?" into
// something anyone can read off the file.
//
// `/*!`, not `/*`: esbuild strips ordinary comments when it minifies, banner
// included. The bang marks it a legal comment -- the category minifiers keep
// because licences live there -- which is the only kind that survives to the
// file the edge actually serves, and therefore the only kind worth checking.
//
// Unset -- every local build, and `bin/rails frontend:build` inside the Docker
// image -- it says "dev", which is exactly what those builds are from the
// edge's point of view: not something CI is waiting to see appear.
export function buildStamp(): string {
  const id = process.env.VATIO_BUILD_ID?.trim() || "dev";
  return `/*! vatio build ${id} */`;
}
