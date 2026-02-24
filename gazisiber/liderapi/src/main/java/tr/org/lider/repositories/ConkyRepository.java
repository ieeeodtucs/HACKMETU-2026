package tr.org.lider.repositories;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import tr.org.lider.entities.ConkyTemplate;

public interface ConkyRepository extends BaseJpaRepository<ConkyTemplate, Long>{
	Page<ConkyTemplate> findByDeletedOrderByCreateDateDesc(Pageable pageable, Boolean deleted);

	List<ConkyTemplate> findAllByDeleted(boolean deleted);
}