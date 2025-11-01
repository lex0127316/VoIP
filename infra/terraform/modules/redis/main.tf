resource "aws_elasticache_subnet_group" "this" {
  name       = "${var.name}-redis-subnets"
  subnet_ids = var.subnet_ids
}

resource "aws_elasticache_replication_group" "this" {
  replication_group_id          = var.name
  replication_group_description = "Redis for ${var.name}"
  engine                        = "redis"
  engine_version                = var.engine_version
  node_type                     = var.node_type
  number_cache_clusters         = var.num_cache_clusters
  automatic_failover_enabled    = false
  multi_az_enabled              = false
  at_rest_encryption_enabled    = false
  transit_encryption_enabled    = false
  subnet_group_name             = aws_elasticache_subnet_group.this.name
  security_group_ids            = var.security_group_ids
}


