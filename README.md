


### Docker Commands on Local
docker build -t auth-service .
docker run -p 4000:4000 --env-file .env auth-service
