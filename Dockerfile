FROM node:latest
RUN mkdir /app
WORKDIR /app
ADD package.json /app/package.json
RUN npm install
ADD . /app
