package tr.org.lider.services;

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import tr.org.lider.entities.RoleTypeImpl;
import tr.org.lider.repositories.RoleTypeRepository;

@Service
public class RoleTypeService {

	@Autowired
	RoleTypeRepository roleTypeRepository;

	public RoleTypeImpl saveRoleType(RoleTypeImpl role) {
		return roleTypeRepository.save(role);
	}

	public List<RoleTypeImpl> getRoleTypes() {
		return roleTypeRepository.findAll();
	}

}
