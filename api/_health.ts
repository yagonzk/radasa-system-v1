function configStatus() {
  const databaseUrl = String(process.env.DATABASE_URL ?? "").trim();
  const jwtSecret = String(process.env.JWT_SECRET ?? "");
  const clientOrigin = String(process.env.CLIENT_ORIGIN ?? "").trim();

  return {
    databaseUrl: databaseUrl.length > 0,
    jwtSecret: jwtSecret.length >= 32,
    clientOrigin: clientOrigin.length > 0,
  };
}

export default {
  fetch() {
    const config = configStatus();

    return Response.json(
      {
        status: config.databaseUrl && config.jwtSecret ? "ok" : "degraded",
        runtime: "vercel-node-web-standard",
        config,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  },
};
