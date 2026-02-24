package tr.org.lider.repositories;

import java.util.Date;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Page;

import tr.org.lider.entities.UserSessionImpl;
import tr.org.lider.utils.IUserSessionReport;

public interface UserSessionRepository extends BaseJpaRepository<UserSessionImpl, Long> {


	@Query(value="SELECT s.sessionEvent as sessionEvent, "
			+ "s.username as username, "
			+ "s.createDate as createDate, "
			+ "a.hostname as hostname, "
			+ "a.ipAddresses as ipAddresses, "
			+ "a.macAddresses as macAddresses, " 
			+ "a.agentStatus as agentStatus "
			+ "FROM UserSessionImpl s "
	        + "LEFT JOIN AgentImpl a ON s.agent = a.id "
	        + "WHERE (:sessionTypeId IS NULL OR :sessionTypeId NOT IN (1, 2) OR s.sessionEvent = :sessionTypeId) "
	        + "AND (COALESCE(:username, '') = '' OR s.username LIKE %:username%) "
	        + "AND (COALESCE(:hostname, '') = '' OR a.hostname LIKE %:hostname%) "
	        + "AND (:startDate IS NULL OR s.createDate >= :startDate ) "
	        + "AND (:endDate IS NULL OR s.createDate <= :endDate ) "
	        + "ORDER BY s.createDate ASC")
	Page<IUserSessionReport> findUserSession(
			@Param("sessionTypeId") Integer sessionTypeId,
			@Param("username") String username, 
			@Param("hostname") String hostname,
			@Param("startDate") Date startDate,
			@Param("endDate") Date endDate, 
			Pageable pageable);
}
