FROM node:20.3.0
WORKDIR /app
COPY . .
COPY package.json ./
RUN npm install
CMD ["yarn", "run", "rebuild"]
