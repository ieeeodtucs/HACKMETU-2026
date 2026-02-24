package tr.org.lider.repositories;

import java.util.Date;
import java.util.List;
import javax.transaction.Transactional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import tr.org.lider.entities.AgentImpl;
import tr.org.lider.utils.IUserSessionReport;


public interface AgentRepository extends BaseJpaRepository<AgentImpl, Long>{

	List<AgentImpl> findByJid(String jid);
	
	List<AgentImpl> findByHostname(String hostname);
	
	List<AgentImpl> findByDn(String dn);
	
	List<AgentImpl> findByAgentStatus(String agentStatus);
	
	@Query(value = "SELECT a FROM AgentImpl a LEFT JOIN a.sessions s WHERE s.username = ?1")
	List<AgentImpl> findBySessionUsername(String username);
	
	@Transactional
	@Modifying(clearAutomatically = true)
    @Query("UPDATE AgentImpl agent SET agent.dn = :newDN WHERE agent.dn = :currentDN")
    int updateAgentDN(@Param("currentDN") String currentDN, @Param("newDN") String newDN);
	
	@Transactional
	@Modifying(clearAutomatically = true)
    @Query("UPDATE AgentImpl agent SET agent.dn = :newDN, "
    		+ "agent.hostname = :newHostname, "
    		+ "agent.jid = :newHostname "
    		+ "WHERE agent.dn = :currentDN")
    int updateHostname(@Param("currentDN") String currentDN, @Param("newDN") String newDN, @Param("newHostname") String newHostname);
	
	void deleteByDn(String Dn);
	
	@Query(value = "SELECT property_value as property FROM c_agent_property "
			+ "where property_name= :name "
			+ "AND property_value != \"\" GROUP BY property ORDER BY property ASC", nativeQuery = true)
	List<String> getPropertyValueByName(@Param("name") String name);
	
	@Query(value = "SELECT count(*) FROM c_agent as a "
			+ "where a.create_date > :startDate AND a.create_date < :endDate", nativeQuery = true)
	int getCountByCreateDate(@Param("startDate") Date startDate, @Param("endDate") Date endDate);
	
	@Query(value = "SELECT count(*) FROM c_agent as a "
			+ "where a.create_date >:startDate", nativeQuery = true)
	int getCountByTodayCreateDate(@Param("startDate") Date startDate);
	
	@Query(value = "SELECT count(*) FROM c_agent as a "
			+ "where a.last_login_date >:startDate", nativeQuery = true)
	int getCountByLastLoginToday(@Param("startDate") Date startDate);
	
	@Query(value="SELECT s.sessionEvent as sessionEvent, s.username as username, s.createDate as createDate, a.agentStatus as agentStatus, a.hostname as hostname, a.ipAddresses as ipAddresses, a.macAddresses as macAddresses " +
			"FROM UserSessionImpl s " +
	        "LEFT JOIN AgentImpl a ON s.agent = a.id " +
	        "WHERE a.id = :agentID " +
	        "AND (:sessionTypeId IS NULL OR :sessionTypeId NOT IN (1, 2) OR s.sessionEvent = :sessionTypeId) " +
	        "ORDER BY s.createDate ASC")
	Page<IUserSessionReport> findUserSessionAllByAgent(@Param("agentID") Long agentID, @Param("sessionTypeId") int sessionTypeId, Pageable pageable);
}

