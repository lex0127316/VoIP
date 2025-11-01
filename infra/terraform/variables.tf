variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "db_security_group_ids" {
  type = list(string)
  description = "Security groups for RDS"
}

variable "redis_security_group_ids" {
  type = list(string)
  description = "Security groups for ElastiCache"
}


