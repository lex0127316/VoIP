module "postgres" {
  source              = "./modules/postgres"
  name                = "voip-postgres"
  vpc_id              = var.vpc_id
  subnet_ids          = var.private_subnet_ids
  security_group_ids  = var.db_security_group_ids
}

module "redis" {
  source              = "./modules/redis"
  name                = "voip-redis"
  vpc_id              = var.vpc_id
  subnet_ids          = var.private_subnet_ids
  security_group_ids  = var.redis_security_group_ids
}

output "postgres_connection_string" {
  value     = "postgres://${module.postgres.username}:${module.postgres.password}@${module.postgres.endpoint}/${module.postgres.database}"
  sensitive = true
}

output "redis_url" {
  value = "redis://${module.redis.primary_endpoint}:${module.redis.port}"
}


