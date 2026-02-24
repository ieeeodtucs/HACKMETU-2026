package tr.org.lider.repositories;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import tr.org.lider.entities.OperationLogImpl;

public interface OperationLogRepository extends BaseJpaRepository<OperationLogImpl, Long> {
	
	@Query(value = "SELECT o FROM OperationLogImpl o "
			+ "WHERE o.userId LIKE %:userId% "
			+ "AND :operationType IS NULL OR :operationType NOT IN (:login, :logout) OR o.operationType = :operationType")
	Page<OperationLogImpl> findByUserIdAndOperationType(
			@Param("userId") String userId,
			@Param("operationType") int operationType,
			@Param("login") int login,
			@Param("logout") int logout,
			Pageable pageable);
	
	@Query(value = "SELECT o FROM OperationLogImpl o WHERE o.userId LIKE %?1%")
	Page<OperationLogImpl> findOrderByCreateDateDesc10ByUserId(String userId, Pageable pageable);
		
}

