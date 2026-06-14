FROM nginx:alpine

# Copiar todos los archivos del proyecto a la carpeta que sirve Nginx
COPY . /usr/share/nginx/html

# Exponer el puerto 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
