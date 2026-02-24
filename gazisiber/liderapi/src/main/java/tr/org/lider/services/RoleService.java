package tr.org.lider.services;

import java.util.ArrayList;
import java.util.List;

import javax.annotation.PostConstruct;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import tr.org.lider.entities.RoleImpl;
import tr.org.lider.repositories.RoleRepository;
import tr.org.lider.repositories.RoleTypeRepository;
import tr.org.lider.entities.RoleTypeImpl;

@Service
public class RoleService {

	@Autowired
	RoleRepository roleRepository;
	
	@Autowired
	RoleTypeRepository roleTypeRepository;

	@PostConstruct
	public void init() throws Exception {
		//roleTypeRepository.deleteAll();
		roleRepository.deleteAll();
		List<RoleTypeImpl> roleTypeList = new ArrayList<>();
		List<RoleTypeImpl> roleTypeList2 = new ArrayList<>();
		roleTypeList.add(new RoleTypeImpl("Admin Yetkisi", "role_admin"));
		roleTypeList.add(new RoleTypeImpl("Arayüz Erişim Ayarları", "role_console"));
		roleTypeList.add(new RoleTypeImpl("İstemci Yönetimi", "role_computer"));
		roleTypeList.add(new RoleTypeImpl("Kullanıcı Yönetimi", "role_user"));
		roleTypeList.add(new RoleTypeImpl("Aktif Dizin Yönetimi", "role_ad"));
		roleTypeList.add(new RoleTypeImpl("Raporlama", "role_report"));
		roleTypeList.add(new RoleTypeImpl("Kullanıcı Politika Yönetimi", "role_policy"));
		roleTypeList.add(new RoleTypeImpl("Ayarlar", "role_settings"));
		roleTypeList.add(new RoleTypeImpl("Tanımlamalar", "role_definition"));
		roleTypeList.add(new RoleTypeImpl("Eklentiler", "role_plugin"));
		
		for (int i = 0; i < roleTypeList.size(); i++) {
			if (roleTypeRepository.findByCode(roleTypeList.get(i).getCode()).isEmpty()) {
				roleTypeList2.add(roleTypeList.get(i));
			}
		}
		roleTypeRepository.saveAll(roleTypeList2);
		
//		roleRepository.deleteAll();
		List<RoleImpl> roleList = new ArrayList<>();
		roleList.add(new RoleImpl("Tüm Yetkiler(Admin)", "ROLE_ADMIN", 0, findRoleTypeByCode("role_admin")));
		roleList.add(new RoleImpl("Arayüz Erişim Yetkisi", "ROLE_USER", 1, findRoleTypeByCode("role_console")));
		roleList.add(new RoleImpl("İstemci Yönetimi", "ROLE_COMPUTERS", 10, findRoleTypeByCode("role_computer")));
		roleList.add(new RoleImpl("İstemci Grup Yönetimi", "ROLE_COMPUTER_GROUPS", 12, findRoleTypeByCode("role_computer")));
		roleList.add(new RoleImpl("Kullanıcı İşlemleri", "ROLE_USERS", 20, findRoleTypeByCode("role_user")));
		roleList.add(new RoleImpl("Kullanıcı Grup Yönetimi", "ROLE_USER_GROUPS", 22, findRoleTypeByCode("role_user")));
		roleList.add(new RoleImpl("Kullanıcı Yetkilendirme(Sudo)", "ROLE_SUDO_GROUPS", 24, findRoleTypeByCode("role_user")));
		roleList.add(new RoleImpl("AD Senkronizasyon", "ROLE_AD_SYNC", 30, findRoleTypeByCode("role_ad")));
		roleList.add(new RoleImpl("Detaylı İstemci Raporu", "ROLE_AGENT_INFO", 40, findRoleTypeByCode("role_report")));
		roleList.add(new RoleImpl("Çalıştırılan Görevler Raporu", "ROLE_EXECUTED_TASK", 42, findRoleTypeByCode("role_report")));
		roleList.add(new RoleImpl("Sistem Güncesi Raporu", "ROLE_OPERATION_LOG", 44, findRoleTypeByCode("role_report")));
		roleList.add(new RoleImpl("Zamanlanmış Görev Raporu", "ROLE_SCHEDULE_TASK", 46, findRoleTypeByCode("role_report")));
		roleList.add(new RoleImpl("Kullanıcı Oturum Raporu", "ROLE_USER_SESSION_REPORT", 48, findRoleTypeByCode("role_report")));

		roleList.add(new RoleImpl("Politika Yönetimi", "ROLE_POLICY", 50, findRoleTypeByCode("role_policy")));
		roleList.add(new RoleImpl("Arayüz Erişim Ayarları", "ROLE_CONSOLE_ACCESS_SETTINGS", 60, findRoleTypeByCode("role_settings")));
		roleList.add(new RoleImpl("Sunucu Ayarları", "ROLE_SERVER_SETTINGS", 62, findRoleTypeByCode("role_settings")));
		roleList.add(new RoleImpl("Sunucu Bilgileri", "ROLE_SERVER_INFORMATION", 64, findRoleTypeByCode("role_settings")));
		roleList.add(new RoleImpl("Sistem Gözlemcisi Tanımları", "ROLE_CONKY_DEFINITION", 80, findRoleTypeByCode("role_definition")));
		roleList.add(new RoleImpl("Betik Tanımları", "ROLE_SCRIPT_DEFINITION", 82, findRoleTypeByCode("role_definition")));
		roleList.add(new RoleImpl("ETA Mesaj Tanımları", "ROLE_ETA_MESSAGE_DEFINITION", 84, findRoleTypeByCode("role_definition")));
		roleList.add(new RoleImpl("Kayıt Şablonları", "ROLE_REGISTRATION_TEMPLATE", 86, findRoleTypeByCode("role_definition")));
 
		// role plugins
		roleList.add(new RoleImpl("Kaynak Kullanımı", "ROLE_RESOURCE_USAGE", 100, findRoleTypeByCode("role_plugin")));
		roleList.add(new RoleImpl("Oturum Yönetimi", "ROLE_SESSION_POWER", 101, findRoleTypeByCode("role_plugin")));
		roleList.add(new RoleImpl("Root Parola Yönetimi", "ROLE_MANAGE_ROOT", 102, findRoleTypeByCode("role_plugin")));
		roleList.add(new RoleImpl("Dosya Transferi", "ROLE_FILE_TRANSFER", 103, findRoleTypeByCode("role_plugin")));
		roleList.add(new RoleImpl("Yerel Kullanıcı Yönetimi", "ROLE_LOCAL_USER", 104, findRoleTypeByCode("role_plugin")));
		roleList.add(new RoleImpl("İstemci Oturum Açma Ayarları", "ROLE_LOGIN_MANAGER", 105, findRoleTypeByCode("role_plugin")));
		roleList.add(new RoleImpl("Dosya Yönetimi", "ROLE_FILE_MANAGEMENT", 106, findRoleTypeByCode("role_plugin")));
		roleList.add(new RoleImpl("Anlık Mesaj Gönder", "ROLE_SEND_MESSAGE", 107, findRoleTypeByCode("role_plugin")));
		roleList.add(new RoleImpl("Sistem Gözlemcisi", "ROLE_CONKY", 108, findRoleTypeByCode("role_plugin")));
		roleList.add(new RoleImpl("Paket Kur veya Kaldır", "ROLE_PACKAGE_INSTALL_REMOVE", 109, findRoleTypeByCode("role_plugin")));
		roleList.add(new RoleImpl("Paket Kontrolü", "ROLE_PACKAGE_CONTROL", 110, findRoleTypeByCode("role_plugin")));
		roleList.add(new RoleImpl("Paket Listesi", "ROLE_PACKAGE_LIST", 111, findRoleTypeByCode("role_plugin")));
		roleList.add(new RoleImpl("Depo Yönetimi", "ROLE_PACKAGE_REPO", 112, findRoleTypeByCode("role_plugin")));
		roleList.add(new RoleImpl("Servis Yönetimi", "ROLE_SERVICE_MANAGEMENT", 113, findRoleTypeByCode("role_plugin")));
		roleList.add(new RoleImpl("Betik", "ROLE_SCRIPT", 114, findRoleTypeByCode("role_plugin")));
		roleList.add(new RoleImpl("USB Kural Yönetimi(beyaz/kara liste)", "ROLE_USB_RULE", 115, findRoleTypeByCode("role_plugin")));
		roleList.add(new RoleImpl("Aygıt Yönetimi", "ROLE_DEVICE_MANAGEMENT", 116, findRoleTypeByCode("role_plugin")));
		roleList.add(new RoleImpl("Ağ Yönetimi", "ROLE_NETWORK_MANAGER", 117, findRoleTypeByCode("role_plugin")));
		roleList.add(new RoleImpl("Uzak Erişim", "ROLE_REMOTE_ACCESS", 118, findRoleTypeByCode("role_plugin")));
		roleList.add(new RoleImpl("Görev Geçmişi", "ROLE_TASK_HISTORY", 119, findRoleTypeByCode("role_plugin")));
		
		List<RoleImpl> roleList2 = new ArrayList<>();
		for (int i = 0; i < roleList.size(); i++) {
			if (findRoleByValue(roleList.get(i).getValue()).isEmpty()) {
				roleList2.add(roleList.get(i));
			}
		}
		roleRepository.saveAll(roleList2);
	}

	public RoleImpl saveRole(RoleImpl role) {
		return roleRepository.save(role);
	}

	public List<RoleImpl> getRoles() {
		return roleRepository.findAllByOrderByOrderNumberAsc();
	}
	
	public RoleTypeImpl findRoleTypeByCode(String code) {
		List<RoleTypeImpl> roleType =  roleTypeRepository.findByCode(code);
		return roleType.get(0);
	}
	
	public List<RoleImpl> findRoleByValue(String value) {
		return roleRepository.findByValue(value);
	}

}
