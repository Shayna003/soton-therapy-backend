FROM denoland/deno:latest

EXPOSE 3000

WORKDIR /app


COPY . .

RUN deno cache src/server.ts


