package tr.org.lider.repositories;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;

import tr.org.lider.entities.RegistrationTemplateImpl;
import tr.org.lider.models.RegistrationTemplateType;

public interface RegistrationTemplateRepository extends BaseJpaRepository<RegistrationTemplateImpl, Long>{
	
	@Query("SELECT rt FROM RegistrationTemplateImpl rt ORDER BY CHAR_LENGTH(rt.unitId) DESC")
	List<RegistrationTemplateImpl> findAllOrderByUnitIdLength();
	
	Page<RegistrationTemplateImpl> findAllByTemplateType(Pageable pageable, RegistrationTemplateType templateType);
}

