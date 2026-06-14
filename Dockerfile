FROM node:20-alpine

WORKDIR /app

# Copiar todos los archivos del proyecto
COPY . /app

# Exponer el puerto 80
EXPOSE 80

CMD ["node", "server.js"]
