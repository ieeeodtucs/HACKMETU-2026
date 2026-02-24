package tr.org.lider.repositories;

import java.util.List;

import tr.org.lider.entities.ServerInformationImpl;

public interface ServerInformationRepository extends BaseJpaRepository<ServerInformationImpl, Long>{

	List<ServerInformationImpl> findByServerId(Long id);
}
