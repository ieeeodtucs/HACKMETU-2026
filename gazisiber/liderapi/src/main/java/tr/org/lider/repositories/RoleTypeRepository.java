package tr.org.lider.repositories;

import java.util.List;

import org.springframework.stereotype.Repository;

import tr.org.lider.entities.RoleTypeImpl;

@Repository
public interface RoleTypeRepository extends BaseJpaRepository<RoleTypeImpl, Long>{
	List<RoleTypeImpl> findAllByName(String name);
	List<RoleTypeImpl> findByCode(String code);
	Long countByName(String name);
}

