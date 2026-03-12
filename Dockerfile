FROM oven/bun:latest

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile || bun install

COPY . .

RUN mkdir -p uploads

EXPOSE 3000

CMD ["bun", "src/index.ts"]
