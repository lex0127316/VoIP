variable "name" { type = string }
variable "engine_version" { type = string default = "15.5" }
variable "instance_class" { type = string default = "db.t3.micro" }
variable "allocated_storage" { type = number default = 20 }
variable "username" { type = string default = "postgres" }
variable "db_name" { type = string default = "voip" }
variable "vpc_id" { type = string }
variable "subnet_ids" { type = list(string) }
variable "security_group_ids" { type = list(string) }


