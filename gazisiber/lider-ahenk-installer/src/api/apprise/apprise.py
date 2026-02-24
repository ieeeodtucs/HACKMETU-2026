#!/usr/bin/python3
# -*- coding: utf-8 -*-

import os
from api.config.config_manager import ConfigManager
from api.logger.installer_logger import Logger


class AppriseInstaller(object):

    def __init__(self, ssh_api, ssh_status):
        self.ssh_api = ssh_api
        self.ssh_status = ssh_status
        self.logger = Logger()
        self.config_manager = ConfigManager()

        self.compose_template_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            '../../conf/docker-compose-apprise.yml'
        )
        self.compose_out_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            '../../dist/docker-compose-apprise.yml'
        )

        self.apprise_dir = "/opt/apprise"
        self.cmd_check_docker = "docker --version"
        self.cmd_install_docker = "curl -fsSL https://get.docker.com | sh"
        self.cmd_mkdir = "sudo mkdir -p {0}"
        self.cmd_cp_compose = "sudo cp /tmp/docker-compose-apprise.yml {0}/docker-compose.yml"
        self.cmd_compose_up = "cd {0} && sudo docker compose up -d"
        self.cmd_compose_pull = "cd {0} && sudo docker compose pull"
        self.cmd_check_container = "sudo docker ps --filter name=apprise --format '{{{{.Names}}}}'"
        self.cmd_rm_tmp = "sudo rm -f /tmp/docker-compose-apprise.yml"

    def install(self, data):
        if self.ssh_status != "Successfully Authenticated":
            self.logger.error(
                "Bildirim sunucusuna bağlantı sağlanamadığı için kurulum yapılamadı. "
                "Lütfen bağlantı ayarlarını kontrol ediniz!"
            )
            return

        apprise_port = data.get("apprise_port", "8000")

        # Process compose template
        f_in = open(self.compose_template_path, 'r')
        compose_data = f_in.read()
        f_in.close()

        conf_data = {
            "#APPRISE_PORT": apprise_port,
        }
        txt = self.config_manager.replace_all(compose_data, conf_data)

        f_out = open(self.compose_out_path, 'w')
        f_out.write(txt)
        f_out.close()
        self.logger.info("docker-compose-apprise.yml dosyası oluşturuldu")

        # Check if Docker is installed
        result_code = self.ssh_api.run_command(self.cmd_check_docker)
        if result_code != 0:
            self.logger.info("Docker bulunamadı, kuruluyor...")
            result_code = self.ssh_api.run_command(self.cmd_install_docker)
            if result_code == 0:
                self.logger.info("Docker başarıyla kuruldu")
            else:
                self.logger.error(
                    "Docker kurulamadı, result_code: " + str(result_code)
                )
                return
        else:
            self.logger.info("Docker zaten kurulu")

        # Create target directory
        result_code = self.ssh_api.run_command(
            self.cmd_mkdir.format(self.apprise_dir)
        )
        if result_code == 0:
            self.logger.info("{0} dizini oluşturuldu".format(self.apprise_dir))
        else:
            self.logger.error(
                "{0} dizini oluşturulamadı, result_code: ".format(self.apprise_dir)
                + str(result_code)
            )

        # Copy compose file to target
        self.ssh_api.scp_file(self.compose_out_path, "/tmp")
        self.logger.info("docker-compose dosyası sunucuya kopyalandı")

        result_code = self.ssh_api.run_command(
            self.cmd_cp_compose.format(self.apprise_dir)
        )
        if result_code == 0:
            self.logger.info("docker-compose dosyası {0} dizinine taşındı".format(self.apprise_dir))
        else:
            self.logger.error(
                "docker-compose dosyası taşınamadı, result_code: " + str(result_code)
            )

        # Pull image and start container
        result_code = self.ssh_api.run_command(
            self.cmd_compose_pull.format(self.apprise_dir)
        )
        if result_code == 0:
            self.logger.info("Apprise Docker image indirildi")
        else:
            self.logger.warning(
                "Apprise Docker image indirilemedi, result_code: " + str(result_code)
            )

        result_code = self.ssh_api.run_command(
            self.cmd_compose_up.format(self.apprise_dir)
        )
        if result_code == 0:
            self.logger.info("Apprise konteyneri başlatıldı")
        else:
            self.logger.error(
                "Apprise konteyneri başlatılamadı, result_code: " + str(result_code)
            )
            return

        # Verify container is running
        result_code = self.ssh_api.run_command(self.cmd_check_container)
        if result_code == 0:
            self.logger.info("Apprise konteyneri çalışıyor")
        else:
            self.logger.warning("Apprise konteyneri çalışmıyor olabilir")

        # Clean up
        self.ssh_api.run_command(self.cmd_rm_tmp)
        self.logger.info("Apprise bildirim sunucusu kurulumu tamamlandı (port: {0})".format(apprise_port))
