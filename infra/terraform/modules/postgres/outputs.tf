output "endpoint" { value = aws_db_instance.this.endpoint }
output "port" { value = aws_db_instance.this.port }
output "username" { value = aws_db_instance.this.username }
output "password" { value = random_password.db.result sensitive = true }
output "database" { value = aws_db_instance.this.db_name }


