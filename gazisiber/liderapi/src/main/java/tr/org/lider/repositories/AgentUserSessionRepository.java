package tr.org.lider.repositories;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import tr.org.lider.entities.UserSessionImpl;


public interface AgentUserSessionRepository extends BaseJpaRepository<UserSessionImpl, Long>{

	Page<UserSessionImpl> findByUsername(String username, Pageable pageable);
}

